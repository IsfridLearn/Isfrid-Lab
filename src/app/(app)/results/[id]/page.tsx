import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, CheckCircle2, RotateCcw, X, XCircle } from "lucide-react";
import { startAttempt } from "@/app/actions/attempts";
import { ScoreRing } from "@/components/charts";
import { SubmitButton } from "@/components/client-ui";
import { Badge, buttonClass, Card, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { ResultSummary } from "@/components/workspace";
import { requireProfile } from "@/lib/auth";
import { languageInfo, modeLabel } from "@/lib/languages";
import { cn, formatDate, formatDuration } from "@/lib/utils";
import type { Attempt, AttemptAnswer, SubmissionResult } from "@/lib/types";

export const metadata = { title: "Assessment results" };

interface ChoiceKey {
  options?: { id: string; body: string; is_correct: boolean }[];
  accepted?: string[];
  explanation?: string | null;
}
interface CodingKey {
  language?: string;
  validation?: string;
  blanks?: { n: number; answers: string[] }[];
  expected_output?: string;
  solution?: string;
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-fg-subtle">{label}</p>
      <pre className="max-h-72 overflow-auto rounded-lg bg-code-bg p-3 font-mono text-xs leading-relaxed text-code-fg">{code}</pre>
    </div>
  );
}

function ChoiceReview({ answer }: { answer: AttemptAnswer }) {
  const key = (answer.correct_answer ?? {}) as ChoiceKey;
  const response = (answer.response ?? {}) as { selected?: string[]; text?: string };
  return (
    <>
      {key.options ? (
        <ul className="mt-3 space-y-1.5">
          {key.options.map((option) => {
            const chosen = response.selected?.includes(option.id) ?? false;
            return (
              <li
                key={option.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
                  option.is_correct ? "border-success/40 bg-success-soft" : chosen ? "border-danger/40 bg-danger-soft" : "border-border",
                )}
              >
                {option.is_correct ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : chosen ? <X className="mt-0.5 size-4 shrink-0 text-danger" /> : <span className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{option.body}</span>
                {chosen ? <span className="text-xs text-fg-muted">Your answer</span> : null}
              </li>
            );
          })}
          {!response.selected?.length ? <li className="text-sm text-fg-subtle">Not answered.</li> : null}
        </ul>
      ) : (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className={cn("rounded-lg border px-3 py-2", answer.is_correct ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft")}>
            <dt className="text-xs text-fg-muted">Your answer</dt>
            <dd className="mt-0.5 font-medium">{response.text?.trim() || "Not answered"}</dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-fg-muted">Accepted {key.accepted && key.accepted.length > 1 ? "answers" : "answer"}</dt>
            <dd className="mt-0.5 font-medium">{(key.accepted ?? []).join(" · ")}</dd>
          </div>
        </dl>
      )}
      {key.explanation ? <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-fg-muted">{key.explanation}</p> : null}
    </>
  );
}

function CodingReview({ answer }: { answer: AttemptAnswer }) {
  const key = (answer.correct_answer ?? {}) as CodingKey;
  const response = answer.response as { code?: string; output?: string | null; result?: SubmissionResult } | null;
  return (
    <div className="mt-3 space-y-3">
      {!response ? <p className="text-sm text-fg-subtle">Nothing was submitted for this exercise.</p> : null}
      {response?.result ? <ResultSummary result={response.result} points={Number(answer.points_possible)} /> : null}
      {response?.code && key.validation !== "output" ? <CodeBlock label="Your submission" code={response.code} /> : null}
      <details className="rounded-lg border border-border px-3 py-2 text-sm">
        <summary className="font-medium text-fg-muted">Show answer key</summary>
        <div className="mt-3 space-y-3">
          {key.blanks?.length ? (
            <ul className="space-y-1 font-mono text-xs">
              {key.blanks.map((blank) => (
                <li key={blank.n}>
                  <span className="text-fg-subtle">__{blank.n}__ = </span>
                  {blank.answers.join("  or  ")}
                </li>
              ))}
            </ul>
          ) : null}
          {key.expected_output != null ? <CodeBlock label="Expected output" code={key.expected_output} /> : null}
          {key.solution ? <CodeBlock label={`Reference solution (${languageInfo(key.language ?? "").label})`} code={key.solution} /> : null}
          {!key.blanks?.length && key.expected_output == null && !key.solution ? <p className="text-fg-subtle">No reference solution was saved for this exercise.</p> : null}
        </div>
      </details>
    </div>
  );
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const [attemptRes, answersRes] = await Promise.all([
    supabase.from("assessment_attempts").select("*").eq("id", id).maybeSingle(),
    supabase.from("assessment_answers").select("*").eq("attempt_id", id).order("position"),
  ]);
  const attempt = attemptRes.data as Attempt | null;
  if (!attempt) notFound();
  if (attempt.status !== "completed") redirect(`/attempt/${attempt.id}`);
  const answers = (answersRes.data ?? []) as AttemptAnswer[];
  const score = Number(attempt.score_percent);
  const wrong = answers.filter((a) => !a.is_correct).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={<Link href="/history" className="hover:text-fg">Assessment History</Link>}
        title={attempt.set_title}
        description={`${modeLabel(attempt.mode)} · ${attempt.completed_at ? formatDate(attempt.completed_at, profile.timezone, true) : ""}`}
        actions={
          attempt.set_id ? (
            <>
              <Link href={`/sets/${attempt.set_id}`} className={buttonClass("secondary")}>
                Back to set
              </Link>
              <form action={startAttempt.bind(null, attempt.set_id)}>
                {attempt.time_limit_seconds ? (
                  <>
                    <input type="hidden" name="timed" value="on" />
                    <input type="hidden" name="minutes" value={Math.round(attempt.time_limit_seconds / 60)} />
                  </>
                ) : null}
                <SubmitButton>
                  <RotateCcw /> Retake
                </SubmitButton>
              </form>
            </>
          ) : (
            <Badge>The study set was deleted</Badge>
          )
        }
      />

      <Card className="flex flex-wrap items-center gap-8 p-6">
        <ScoreRing percent={score} />
        <div className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Correct" value={`${attempt.correct_count} / ${attempt.item_count}`} />
          <Stat label="Points" value={`${Number(attempt.earned_points)} / ${Number(attempt.total_points)}`} />
          <Stat label="Completion time" value={formatDuration(attempt.duration_seconds)} detail={attempt.time_limit_seconds ? `limit ${formatDuration(attempt.time_limit_seconds)}` : "untimed"} />
          <Stat label="To review" value={wrong} detail={wrong === 0 ? "nothing missed" : wrong === 1 ? "item missed" : "items missed"} />
        </div>
      </Card>

      <div className="mt-8">
        <SectionTitle>Answer review</SectionTitle>
        <ol className="space-y-4">
          {answers.map((answer, index) => (
            <li key={answer.id} className="rounded-card border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                {answer.is_correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-subtle">
                    {attempt.mode === "coding" ? "Exercise" : "Question"} {index + 1} · {Number(answer.points_earned)} / {Number(answer.points_possible)} points
                  </p>
                  <p className="mt-1 text-[15px] font-medium whitespace-pre-wrap">{answer.prompt}</p>
                  {attempt.mode === "coding" ? <CodingReview answer={answer} /> : <ChoiceReview answer={answer} />}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
