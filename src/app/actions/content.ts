"use server";

// Questions (multiple choice, identification) and coding exercises.
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { blankNumbers } from "@/lib/grading";
import { EXERCISE_TYPES, LANGUAGES, VALIDATIONS } from "@/lib/languages";
import { isUuid, uuidOrNull } from "@/lib/security";
import type { ExerciseType, LanguageId, Validation } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface QuestionInput {
  id?: string;
  setId: string;
  prompt: string;
  explanation?: string;
  points?: number;
  options?: { body: string; is_correct: boolean }[];
  accepted?: string[];
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
}

const clampPoints = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : fallback;
};

export async function saveQuestion(input: QuestionInput): Promise<Result<{ id: string }>> {
  const { supabase } = await requireProfile();
  if (!input || !isUuid(input.setId) || (input.id != null && !isUuid(input.id))) return { ok: false, error: "Study set not found." };
  const { data: set } = await supabase.from("study_sets").select("id, mode").eq("id", input.setId).maybeSingle();
  if (!set || set.mode === "coding") return { ok: false, error: "Study set not found." };
  const sourcePage = Number(input.sourcePage);

  const prompt = String(input.prompt ?? "").trim().slice(0, 4000);
  if (!prompt) return { ok: false, error: "Write the question." };

  const options = (Array.isArray(input.options) ? input.options : [])
    .slice(0, 20)
    .map((o) => ({ body: String(o.body ?? "").trim().slice(0, 1000), is_correct: Boolean(o.is_correct) }))
    .filter((o) => o.body);
  const accepted = [...new Set((Array.isArray(input.accepted) ? input.accepted : []).slice(0, 20).map((a) => String(a).trim().slice(0, 500)).filter(Boolean))];

  if (set.mode === "multiple_choice") {
    if (options.length < 2) return { ok: false, error: "Add at least two answer choices." };
    if (options.length > 8) return { ok: false, error: "Use at most eight answer choices." };
    if (!options.some((o) => o.is_correct)) return { ok: false, error: "Mark at least one choice as correct." };
  } else if (accepted.length === 0) {
    return { ok: false, error: "Add at least one accepted answer." };
  }

  const fields = {
    prompt,
    explanation: String(input.explanation ?? "").trim().slice(0, 4000) || null,
    points: clampPoints(input.points, 1),
  };

  let questionId = input.id;
  if (questionId) {
    const { error } = await supabase.from("questions").update(fields).eq("id", questionId).eq("set_id", set.id);
    if (error) return { ok: false, error: "Could not save the question." };
    await supabase.from("answer_options").delete().eq("question_id", questionId);
    await supabase.from("accepted_answers").delete().eq("question_id", questionId);
  } else {
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("set_id", set.id);
    const { data, error } = await supabase
      .from("questions")
      .insert({
        ...fields,
        set_id: set.id,
        type: set.mode,
        position: count ?? 0,
        source_document_id: uuidOrNull(input.sourceDocumentId),
        source_page: Number.isInteger(sourcePage) && sourcePage >= 1 && sourcePage <= 100000 ? sourcePage : null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Could not save the question." };
    questionId = data.id as string;
  }

  const child =
    set.mode === "multiple_choice"
      ? await supabase.from("answer_options").insert(options.map((o, position) => ({ ...o, position, question_id: questionId })))
      : await supabase.from("accepted_answers").insert(accepted.map((body) => ({ body, question_id: questionId })));
  if (child.error) return { ok: false, error: "The question was saved but its answers were not. Open it and save again." };

  await supabase.from("study_sets").update({ updated_at: new Date().toISOString() }).eq("id", set.id);
  revalidatePath(`/sets/${set.id}`);
  revalidatePath(`/sets/${set.id}/edit`);
  return { ok: true, id: questionId! };
}

export async function deleteQuestion(id: string, setId: string): Promise<Result> {
  const { supabase } = await requireProfile();
  if (!isUuid(id) || !isUuid(setId)) return { ok: false, error: "Could not delete the question." };
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the question." };
  revalidatePath(`/sets/${setId}`);
  revalidatePath(`/sets/${setId}/edit`);
  return { ok: true };
}

export interface ExerciseInput {
  id?: string;
  setId: string;
  title: string;
  exerciseType: ExerciseType;
  language: LanguageId;
  description: string;
  instructions: string;
  hints: string[];
  templateCode: string;
  solutionCode: string;
  setupCode: string;
  validation: Validation;
  blanks: { n: number; answers: string[] }[];
  expectedOutput: string;
  points: number;
  testCases: { stdin: string; expected_output: string; is_hidden: boolean }[];
}

const CODE_LIMIT = 20000;

export async function saveExercise(input: ExerciseInput): Promise<Result<{ id: string }>> {
  const { supabase, isTechnical } = await requireProfile();
  if (!isTechnical) return { ok: false, error: "Fill in the Code is available to technology programs." };
  if (!input || !isUuid(input.setId) || (input.id != null && !isUuid(input.id))) return { ok: false, error: "Study set not found." };
  const { data: set } = await supabase.from("study_sets").select("id, mode").eq("id", input.setId).maybeSingle();
  if (!set || set.mode !== "coding") return { ok: false, error: "Study set not found." };

  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) return { ok: false, error: "Give the exercise a title." };
  if (!EXERCISE_TYPES.some((t) => t.id === input.exerciseType)) return { ok: false, error: "Choose an exercise type." };
  if (!LANGUAGES.some((l) => l.id === input.language)) return { ok: false, error: "Choose a language." };
  if (!VALIDATIONS.some((v) => v.id === input.validation)) return { ok: false, error: "Choose how answers are checked." };

  const templateCode = String(input.templateCode ?? "").slice(0, CODE_LIMIT);
  const solutionCode = String(input.solutionCode ?? "").slice(0, CODE_LIMIT);
  const expectedOutput = String(input.expectedOutput ?? "").slice(0, CODE_LIMIT);
  if (!templateCode.trim()) return { ok: false, error: "Add the code the student starts with." };

  const blanks = (Array.isArray(input.blanks) ? input.blanks : [])
    .slice(0, 50)
    .map((b) => ({ n: Number(b?.n), answers: (Array.isArray(b?.answers) ? b.answers : []).map((a) => String(a).trim()).filter(Boolean).slice(0, 20) }))
    .filter((b) => Number.isInteger(b.n) && b.n >= 0 && b.n < 1000);
  const tests = (Array.isArray(input.testCases) ? input.testCases : []).slice(0, 10).map((t, position) => ({
    stdin: String(t?.stdin ?? "").slice(0, 10000),
    expected_output: String(t?.expected_output ?? "").slice(0, 10000),
    is_hidden: Boolean(t?.is_hidden),
    position,
  }));

  if (input.validation === "blanks") {
    const numbers = blankNumbers(templateCode);
    if (numbers.length === 0) return { ok: false, error: "Add at least one blank (__1__) to the code." };
    const missing = numbers.find((n) => !blanks.find((b) => b.n === n)?.answers.length);
    if (missing != null) return { ok: false, error: `Blank ${missing} needs at least one accepted answer.` };
  }
  if (input.validation === "output" && !expectedOutput.trim()) return { ok: false, error: "Enter the expected output." };
  if (input.validation === "solution" && !solutionCode.trim()) return { ok: false, error: "Enter the reference solution." };
  if (input.validation === "tests" && tests.length === 0) return { ok: false, error: "Add at least one test case." };

  const fields = {
    title,
    exercise_type: input.exerciseType,
    language: input.language,
    description: String(input.description ?? "").trim().slice(0, 8000),
    instructions: String(input.instructions ?? "").trim().slice(0, 4000),
    hints: (Array.isArray(input.hints) ? input.hints : []).map((h) => String(h).trim().slice(0, 1000)).filter(Boolean).slice(0, 10),
    template_code: templateCode,
    solution_code: solutionCode,
    setup_code: String(input.setupCode ?? "").slice(0, CODE_LIMIT),
    validation: input.validation,
    blanks,
    expected_output: expectedOutput,
    points: clampPoints(input.points, 10),
  };

  let exerciseId = input.id;
  if (exerciseId) {
    const { error } = await supabase.from("coding_exercises").update(fields).eq("id", exerciseId).eq("set_id", set.id);
    if (error) return { ok: false, error: "Could not save the exercise." };
    await supabase.from("coding_test_cases").delete().eq("exercise_id", exerciseId);
  } else {
    const { count } = await supabase.from("coding_exercises").select("id", { count: "exact", head: true }).eq("set_id", set.id);
    const { data, error } = await supabase
      .from("coding_exercises")
      .insert({ ...fields, set_id: set.id, position: count ?? 0 })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Could not save the exercise." };
    exerciseId = data.id as string;
  }
  if (tests.length) {
    const { error } = await supabase.from("coding_test_cases").insert(tests.map((t) => ({ ...t, exercise_id: exerciseId })));
    if (error) return { ok: false, error: "The exercise was saved but its test cases were not. Save again." };
  }

  await supabase.from("study_sets").update({ updated_at: new Date().toISOString() }).eq("id", set.id);
  revalidatePath(`/sets/${set.id}`);
  revalidatePath(`/sets/${set.id}/edit`);
  revalidatePath("/codelab");
  return { ok: true, id: exerciseId! };
}

export async function deleteExercise(id: string, setId: string): Promise<Result> {
  const { supabase } = await requireProfile();
  if (!isUuid(id) || !isUuid(setId)) return { ok: false, error: "Could not delete the exercise." };
  const { error } = await supabase.from("coding_exercises").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the exercise." };
  revalidatePath(`/sets/${setId}`);
  revalidatePath(`/sets/${setId}/edit`);
  revalidatePath("/codelab");
  return { ok: true };
}
