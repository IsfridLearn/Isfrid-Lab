"use server";

// The assessment engine: start, grade and finish attempts. All grading happens here.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { executeRemote, RATE_LIMIT_MESSAGE, takeExecutionTokens } from "@/lib/execution";
import {
  gradeBlanks,
  gradeIdentification,
  gradeMultipleChoice,
  gradeOutputPrediction,
  gradeSolutionMatch,
  outputsMatch,
  summarize,
} from "@/lib/grading";
import { languageInfo } from "@/lib/languages";
import { isUuid } from "@/lib/security";
import { shuffle } from "@/lib/utils";
import type { Attempt, AttemptItem, CheckResult, CodingExercise, Question, StudySet, SubmissionResult } from "@/lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;

function timing(attempt: Attempt) {
  const elapsed = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));
  const duration = attempt.time_limit_seconds ? Math.min(elapsed, attempt.time_limit_seconds) : elapsed;
  return { completed_at: new Date().toISOString(), duration_seconds: duration };
}

export async function startAttempt(setId: string, formData: FormData) {
  const { supabase } = await requireProfile();
  if (!isUuid(setId)) redirect("/sets");
  const { data } = await supabase.from("study_sets").select("*").eq("id", setId).maybeSingle();
  const set = data as StudySet | null;
  if (!set) redirect("/sets");

  let items: AttemptItem[];
  if (set.mode === "coding") {
    const { data: exercises } = await supabase.from("coding_exercises").select("id").eq("set_id", set.id).order("position");
    items = (exercises ?? []).map((e) => ({ id: e.id as string }));
  } else {
    const { data: questions } = await supabase
      .from("questions")
      .select("id, answer_options(id, position)")
      .eq("set_id", set.id)
      .order("position");
    items = (questions ?? []).map((q) => {
      const options = [...((q.answer_options ?? []) as { id: string; position: number }[])]
        .sort((a, b) => a.position - b.position)
        .map((o) => o.id);
      return { id: q.id as string, options: set.shuffle_options ? shuffle(options) : options };
    });
    if (set.shuffle_questions) items = shuffle(items);
  }
  if (items.length === 0) redirect(`/sets/${set.id}/edit`);

  const minutes = Number(formData.get("minutes"));
  const timed = formData.get("timed") === "on" && Number.isInteger(minutes) && minutes >= 1 && minutes <= 600;

  const { data: attempt, error } = await supabase
    .from("assessment_attempts")
    .insert({
      set_id: set.id,
      subject_id: set.subject_id,
      set_title: set.title,
      mode: set.mode,
      item_order: items,
      item_count: items.length,
      time_limit_seconds: timed ? minutes * 60 : null,
    })
    .select("id")
    .single();
  if (error || !attempt) redirect(`/sets/${set.id}?error=start`);
  redirect(`/attempt/${attempt.id}`);
}

export async function discardAttempt(attemptId: string) {
  const { supabase } = await requireProfile();
  if (!isUuid(attemptId)) redirect("/sets");
  const { data } = await supabase.from("assessment_attempts").select("set_id").eq("id", attemptId).maybeSingle();
  await supabase.from("assessment_attempts").delete().eq("id", attemptId).eq("status", "in_progress");
  revalidatePath("/dashboard");
  redirect(data?.set_id ? `/sets/${data.set_id}` : "/sets");
}

/** Grade a multiple-choice or identification attempt. */
export async function submitAttempt(attemptId: string, responses: Record<string, string | string[]>) {
  const { supabase } = await requireProfile();
  if (!isUuid(attemptId)) redirect("/history");
  const given = responses && typeof responses === "object" ? responses : {};
  const { data } = await supabase.from("assessment_attempts").select("*").eq("id", attemptId).maybeSingle();
  const attempt = data as Attempt | null;
  if (!attempt || attempt.mode === "coding") redirect("/history");
  if (attempt.status === "completed") redirect(`/results/${attempt.id}`);

  const order = (Array.isArray(attempt.item_order) ? attempt.item_order : []).filter((item) => isUuid(item?.id));
  const ids = order.map((item) => item.id);
  const { data: rows } = await supabase.from("questions").select("*, answer_options(*), accepted_answers(*)").in("id", ids);
  const questions = new Map(((rows ?? []) as Question[]).map((q) => [q.id, q]));

  let earned = 0;
  let total = 0;
  let correctCount = 0;
  const answers = order.flatMap((item, position) => {
    const question = questions.get(item.id);
    if (!question) return [];
    const raw = given[item.id];
    let isCorrect: boolean;
    let response: unknown;
    let correctAnswer: unknown;

    if (question.type === "multiple_choice") {
      const validIds = new Set(question.answer_options.map((o) => o.id));
      const selected = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((id) => typeof id === "string" && validIds.has(id));
      isCorrect = gradeMultipleChoice(selected, question.answer_options.filter((o) => o.is_correct).map((o) => o.id));
      const shown = Array.isArray(item.options) ? item.options : [];
      const options = [...question.answer_options].sort((a, b) => shown.indexOf(a.id) - shown.indexOf(b.id));
      response = { selected };
      correctAnswer = { options: options.map(({ id, body, is_correct }) => ({ id, body, is_correct })), explanation: question.explanation };
    } else {
      const textResponse = typeof raw === "string" ? raw.slice(0, 500) : "";
      const accepted = question.accepted_answers.map((a) => a.body);
      isCorrect = gradeIdentification(textResponse, accepted);
      response = { text: textResponse };
      correctAnswer = { accepted, explanation: question.explanation };
    }

    total += question.points;
    if (isCorrect) {
      earned += question.points;
      correctCount++;
    }
    return [
      {
        attempt_id: attempt.id,
        question_id: question.id,
        position,
        prompt: question.prompt,
        response,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        points_earned: isCorrect ? question.points : 0,
        points_possible: question.points,
      },
    ];
  });

  if (answers.length) {
    const { error } = await supabase.from("assessment_answers").insert(answers);
    if (error) return { error: "Could not save your answers. Check your connection and submit again." };
  }
  const { error } = await supabase
    .from("assessment_attempts")
    .update({
      status: "completed",
      ...timing(attempt),
      item_count: answers.length,
      correct_count: correctCount,
      total_points: total,
      earned_points: earned,
      score_percent: total > 0 ? round2((earned / total) * 100) : 0,
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) return { error: "Could not finish the assessment. Submit again." };

  revalidatePath("/dashboard");
  revalidatePath("/history");
  redirect(`/results/${attempt.id}`);
}

export interface ClientRun {
  testId: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  error?: string;
}

export interface CodingSubmitInput {
  exerciseId: string;
  attemptId?: string | null;
  code: string;
  outputAnswer?: string;
  clientRuns?: ClientRun[];
}

/** Checks one coding exercise, records the submission and returns the result. */
export async function submitCoding(
  input: CodingSubmitInput,
): Promise<{ ok: true; result: SubmissionResult } | { ok: false; error: string }> {
  const { supabase } = await requireProfile();
  if (!input || !isUuid(input.exerciseId)) return { ok: false, error: "Exercise not found." };
  const attemptId = isUuid(input.attemptId) ? input.attemptId : null;
  const clientRuns = (Array.isArray(input.clientRuns) ? input.clientRuns : []).slice(0, 10);
  const { data } = await supabase.from("coding_exercises").select("*, coding_test_cases(*)").eq("id", input.exerciseId).maybeSingle();
  const exercise = data as CodingExercise | null;
  if (!exercise) return { ok: false, error: "Exercise not found." };
  const code = String(input.code ?? "").slice(0, 64 * 1024);

  let result: SubmissionResult;
  if (exercise.validation === "blanks") {
    result = gradeBlanks(exercise.template_code, exercise.blanks, code);
  } else if (exercise.validation === "output") {
    result = gradeOutputPrediction(String(input.outputAnswer ?? "").slice(0, 20000), exercise.expected_output);
  } else if (exercise.validation === "solution") {
    result = gradeSolutionMatch(code, exercise.solution_code);
  } else {
    const tests = [...exercise.coding_test_cases].sort((a, b) => a.position - b.position);
    const remote = languageInfo(exercise.language).runtime === "remote";
    const checks: CheckResult[] = [];
    if (remote && !(await takeExecutionTokens(supabase, tests.length))) return { ok: false, error: RATE_LIMIT_MESSAGE };
    for (const [index, test] of tests.entries()) {
      const run = remote
        ? await executeRemote(exercise.language, code, test.stdin)
        : (clientRuns.find((r) => r?.testId === test.id) ?? { stdout: "", stderr: "", exitCode: null, error: "This test was not run." });
      if (remote && run.error) return { ok: false, error: run.error };
      const passed = !run.error && !run.timedOut && outputsMatch(String(run.stdout ?? ""), test.expected_output);
      const problem = run.error ?? (run.timedOut ? "Time limit exceeded." : String(run.stderr ?? "").trim() || undefined);
      checks.push(
        test.is_hidden
          ? { label: `Test ${index + 1} (hidden)`, passed, hidden: true }
          : {
              label: `Test ${index + 1}`,
              passed,
              stdin: test.stdin,
              expected: test.expected_output,
              actual: String(run.stdout ?? "").slice(0, 10000),
              error: problem?.slice(0, 4000),
            },
      );
    }
    result = summarize(checks);
  }

  const { error } = await supabase.from("coding_submissions").insert({
    exercise_id: exercise.id,
    attempt_id: attemptId,
    language: exercise.language,
    code: exercise.validation === "output" ? String(input.outputAnswer ?? "").slice(0, 20000) : code,
    status: result.status,
    score: result.score,
    passed_count: result.passed,
    total_count: result.total,
    results: result,
  });
  if (error) return { ok: false, error: "Your answer was checked but could not be saved. Submit again." };

  if (attemptId) {
    const { data: attempt } = await supabase
      .from("assessment_attempts")
      .select("id, status, item_order")
      .eq("id", attemptId)
      .maybeSingle();
    const items = (Array.isArray(attempt?.item_order) ? attempt.item_order : []) as AttemptItem[];
    const position = items.findIndex((item) => item.id === exercise.id);
    if (attempt && attempt.status === "in_progress" && position >= 0) {
      const { error: answerError } = await supabase.from("assessment_answers").upsert(
        {
          attempt_id: attempt.id,
          exercise_id: exercise.id,
          position,
          prompt: exercise.title,
          response: { code, output: input.outputAnswer ?? null, result },
          correct_answer: answerKey(exercise),
          is_correct: result.status === "passed",
          points_earned: round2(result.score * exercise.points),
          points_possible: exercise.points,
        },
        { onConflict: "attempt_id,exercise_id" },
      );
      if (answerError) return { ok: false, error: "Your answer was checked but not recorded in the assessment. Submit again." };
    }
  } else {
    revalidatePath("/codelab");
  }
  return { ok: true, result };
}

function answerKey(exercise: CodingExercise) {
  return {
    language: exercise.language,
    validation: exercise.validation,
    blanks: exercise.validation === "blanks" ? exercise.blanks : undefined,
    expected_output: exercise.validation === "output" ? exercise.expected_output : undefined,
    solution: exercise.solution_code || undefined,
  };
}

/** Close a coding assessment: unanswered exercises score zero. */
export async function finishCodingAttempt(attemptId: string) {
  const { supabase } = await requireProfile();
  if (!isUuid(attemptId)) redirect("/history");
  const { data } = await supabase.from("assessment_attempts").select("*").eq("id", attemptId).maybeSingle();
  const attempt = data as Attempt | null;
  if (!attempt || attempt.mode !== "coding") redirect("/history");
  if (attempt.status === "completed") redirect(`/results/${attempt.id}`);

  const ids = (Array.isArray(attempt.item_order) ? attempt.item_order : []).map((item) => item?.id).filter(isUuid);
  const [{ data: exerciseRows }, { data: answerRows }] = await Promise.all([
    supabase.from("coding_exercises").select("*").in("id", ids),
    supabase.from("assessment_answers").select("exercise_id, is_correct, points_earned, points_possible").eq("attempt_id", attempt.id),
  ]);
  const exercises = (exerciseRows ?? []) as CodingExercise[];
  const answered = new Set((answerRows ?? []).map((a) => a.exercise_id as string));

  const missing = exercises
    .filter((e) => !answered.has(e.id))
    .map((e) => ({
      attempt_id: attempt.id,
      exercise_id: e.id,
      position: ids.indexOf(e.id),
      prompt: e.title,
      response: null,
      correct_answer: answerKey(e),
      is_correct: false,
      points_earned: 0,
      points_possible: e.points,
    }));
  if (missing.length) await supabase.from("assessment_answers").insert(missing);

  const earned = (answerRows ?? []).reduce((sum, a) => sum + Number(a.points_earned), 0);
  const total =
    (answerRows ?? []).reduce((sum, a) => sum + Number(a.points_possible), 0) + missing.reduce((sum, m) => sum + m.points_possible, 0);
  const { error } = await supabase
    .from("assessment_attempts")
    .update({
      status: "completed",
      ...timing(attempt),
      item_count: (answerRows?.length ?? 0) + missing.length,
      correct_count: (answerRows ?? []).filter((a) => a.is_correct).length,
      total_points: total,
      earned_points: round2(earned),
      score_percent: total > 0 ? round2((earned / total) * 100) : 0,
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) return { error: "Could not finish the assessment. Try again." };

  revalidatePath("/dashboard");
  revalidatePath("/history");
  redirect(`/results/${attempt.id}`);
}
