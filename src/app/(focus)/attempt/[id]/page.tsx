import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssessmentRunner, CodingAttempt, type RunnerItem } from "@/components/assessment-runner";
import { buttonClass } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";
import { serverNow } from "@/lib/utils";
import { toWorkspaceExercise, type WorkspaceSubmission } from "@/lib/workspace";
import type { Attempt, CodingExercise, Question } from "@/lib/types";

export const metadata = { title: "Assessment" };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data } = await supabase.from("assessment_attempts").select("*").eq("id", id).maybeSingle();
  const attempt = data as Attempt | null;
  if (!attempt) notFound();
  if (attempt.status === "completed") redirect(`/results/${attempt.id}`);

  const ids = attempt.item_order.map((item) => item.id);
  const common = {
    attemptId: attempt.id,
    title: attempt.set_title,
    startedAt: attempt.started_at,
    timeLimitSeconds: attempt.time_limit_seconds,
  };
  const empty = (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-lg font-semibold">This assessment can&apos;t continue</h1>
      <p className="mt-2 text-sm text-fg-muted">Its questions were deleted after it started.</p>
      <Link href="/sets" className={buttonClass("primary", "md", "mt-6")}>
        Back to study sets
      </Link>
    </div>
  );

  if (attempt.mode === "coding") {
    const [exercisesRes, answersRes, submissionsRes] = await Promise.all([
      supabase.from("coding_exercises").select("*, coding_test_cases(*)").in("id", ids),
      supabase.from("assessment_answers").select("exercise_id, response").eq("attempt_id", attempt.id),
      supabase
        .from("coding_submissions")
        .select("id, exercise_id, status, passed_count, total_count, code, created_at")
        .eq("attempt_id", attempt.id)
        .order("created_at", { ascending: false }),
    ]);
    const byId = new Map(((exercisesRes.data ?? []) as CodingExercise[]).map((e) => [e.id, e]));
    const exercises = ids.flatMap((exerciseId) => (byId.has(exerciseId) ? [toWorkspaceExercise(byId.get(exerciseId)!)] : []));
    if (exercises.length === 0) return empty;

    const initial: Record<string, { code?: string; output?: string; status?: "passed" | "partial" | "failed" }> = {};
    for (const row of answersRes.data ?? []) {
      const response = row.response as { code?: string; output?: string | null; result?: { status?: "passed" | "partial" | "failed" } } | null;
      if (row.exercise_id && response) {
        initial[row.exercise_id as string] = { code: response.code, output: response.output ?? undefined, status: response.result?.status };
      }
    }
    const submissions: Record<string, WorkspaceSubmission[]> = {};
    for (const row of submissionsRes.data ?? []) {
      (submissions[row.exercise_id as string] ??= []).push(row as WorkspaceSubmission);
    }
    return (
      <CodingAttempt
        {...common}
        serverNow={serverNow()}
        exercises={exercises}
        initial={initial}
        submissions={submissions}
        remoteExecutionEnabled={isRemoteExecutionConfigured}
        timeZone={profile.timezone}
      />
    );
  }

  const { data: rows } = await supabase.from("questions").select("*, answer_options(*), accepted_answers(id)").in("id", ids);
  const byId = new Map(((rows ?? []) as Question[]).map((q) => [q.id, q]));
  const items: RunnerItem[] = attempt.item_order.flatMap((entry) => {
    const question = byId.get(entry.id);
    if (!question) return [];
    const order = entry.options ?? [];
    const options = [...question.answer_options]
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      .map((o) => ({ id: o.id, body: o.body }));
    return [
      {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        options,
        multi: question.answer_options.filter((o) => o.is_correct).length > 1,
      },
    ];
  });
  if (items.length === 0) return empty;

  return <AssessmentRunner {...common} serverNow={serverNow()} items={items} />;
}
