"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, Send } from "lucide-react";
import { discardAttempt, finishCodingAttempt, submitAttempt } from "@/app/actions/attempts";
import { Button, Notice } from "@/components/ui";
import { Workspace } from "@/components/workspace";
import { cn, formatClock } from "@/lib/utils";
import type { WorkspaceExercise, WorkspaceSubmission } from "@/lib/workspace";

export interface RunnerItem {
  id: string;
  type: "multiple_choice" | "identification";
  prompt: string;
  points: number;
  options: { id: string; body: string }[];
  multi: boolean;
}

type Answers = Record<string, string | string[]>;

/** Seconds elapsed / remaining, using the server's clock so a wrong device clock can't skew the timer. */
function useClock(startedAt: string, limitSeconds: number | null, serverNow: number, onExpire: () => void) {
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    const started = new Date(startedAt).getTime();
    let fired = false;
    const timer = setInterval(() => {
      const current = Date.now() + offset;
      setNow(current);
      if (!fired && limitSeconds != null && current - started >= limitSeconds * 1000) {
        fired = true;
        expire.current();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [offset, startedAt, limitSeconds]);
  const elapsed = Math.max(0, (now - new Date(startedAt).getTime()) / 1000);
  return { elapsed, remaining: limitSeconds == null ? null : limitSeconds - elapsed };
}

function TimerBadge({ elapsed, remaining }: { elapsed: number; remaining: number | null }) {
  const low = remaining != null && remaining <= 60;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[13px] tabular-nums",
        low ? "bg-danger-soft text-danger" : "bg-muted text-fg-muted",
      )}
      role="timer"
      aria-label={remaining != null ? "Time remaining" : "Time elapsed"}
    >
      <Clock className="size-3.5" />
      {formatClock(remaining != null ? Math.max(0, remaining) : elapsed)}
    </span>
  );
}

function DiscardButton({ attemptId }: { attemptId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Leave and discard this attempt? It won't be scored or saved to your history.")) {
          startTransition(async () => void (await discardAttempt(attemptId)));
        }
      }}
    >
      Discard
    </Button>
  );
}

export function AssessmentRunner({
  attemptId,
  title,
  startedAt,
  timeLimitSeconds,
  serverNow,
  items,
}: {
  attemptId: string;
  title: string;
  startedAt: string;
  timeLimitSeconds: number | null;
  serverNow: number;
  items: RunnerItem[];
}) {
  const storageKey = `isfrid-attempt-${attemptId}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answersRef = useRef(answers);
  const submitted = useRef(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Answers;
        answersRef.current = parsed;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
        setAnswers(parsed);
      }
    } catch {}
  }, [storageKey]);

  const update = (id: string, value: string | string[]) => {
    const next = { ...answersRef.current, [id]: value };
    answersRef.current = next;
    setAnswers(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const isAnswered = (id: string) => {
    const value = answers[id];
    return Array.isArray(value) ? value.length > 0 : Boolean(value && value.trim());
  };
  const answeredCount = items.filter((item) => isAnswered(item.id)).length;

  const submit = (auto = false) => {
    if (submitted.current) return;
    if (!auto && answeredCount < items.length && !window.confirm(`${items.length - answeredCount} unanswered. Submit anyway?`)) return;
    submitted.current = true;
    setError(null);
    startTransition(async () => {
      const result = await submitAttempt(attemptId, answersRef.current);
      if (result?.error) {
        submitted.current = false;
        setError(result.error);
      } else {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
      }
    });
  };

  const { elapsed, remaining } = useClock(startedAt, timeLimitSeconds, serverNow, () => submit(true));
  const timeUp = remaining != null && remaining <= 0;

  const item = items[index];
  const value = answers[item.id];
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-fg-subtle">
              {answeredCount} of {items.length} answered
            </p>
          </div>
          <TimerBadge elapsed={elapsed} remaining={remaining} />
          <DiscardButton attemptId={attemptId} />
          <Button size="sm" onClick={() => submit()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} Submit
          </Button>
        </div>
        <div className="h-0.5 bg-muted">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${(answeredCount / items.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        {error ? <Notice tone="danger" className="mb-5">{error}</Notice> : null}
        {timeUp ? <Notice tone="amber" className="mb-5">Time is up. Submitting your answers…</Notice> : null}

        <div className="grid gap-8 md:grid-cols-[1fr_11rem]">
          <section key={item.id} className="animate-rise">
            <p className="mb-3 flex items-center gap-2 text-xs text-fg-subtle">
              <span className="font-mono">
                Question {index + 1} / {items.length}
              </span>
              · {item.points} {item.points === 1 ? "point" : "points"}
              {item.multi ? " · select all that apply" : ""}
            </p>
            <h1 className="text-xl leading-snug font-medium whitespace-pre-wrap">{item.prompt}</h1>

            {item.type === "multiple_choice" ? (
              <div className="mt-6 space-y-2.5" role={item.multi ? "group" : "radiogroup"}>
                {item.options.map((option, optionIndex) => {
                  const checked = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role={item.multi ? "checkbox" : "radio"}
                      aria-checked={checked}
                      onClick={() =>
                        update(item.id, item.multi ? (checked ? selected.filter((id) => id !== option.id) : [...selected, option.id]) : [option.id])
                      }
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[15px] transition-colors",
                        checked ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center border font-mono text-[11px]",
                          item.multi ? "rounded" : "rounded-full",
                          checked ? "border-brand bg-brand text-brand-fg" : "border-border-strong text-fg-subtle",
                        )}
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span className="whitespace-pre-wrap">{option.body}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-fg-muted">Your answer</span>
                  <input
                    autoFocus
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => update(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && index < items.length - 1) setIndex(index + 1);
                    }}
                    maxLength={500}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-12 w-full rounded-lg border border-border-strong bg-surface px-4 text-base focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                    placeholder="Type your answer"
                  />
                </label>
                <p className="mt-2 text-xs text-fg-subtle">Capital letters don&apos;t matter. Spelling does.</p>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
                <ChevronLeft /> Previous
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFlagged((list) => (list.includes(item.id) ? list.filter((id) => id !== item.id) : [...list, item.id]))}
                className={flagged.includes(item.id) ? "text-amber" : undefined}
                aria-pressed={flagged.includes(item.id)}
              >
                <Flag /> {flagged.includes(item.id) ? "Flagged" : "Flag for review"}
              </Button>
              {index < items.length - 1 ? (
                <Button variant="secondary" onClick={() => setIndex(index + 1)}>
                  Next <ChevronRight />
                </Button>
              ) : (
                <Button onClick={() => submit()} disabled={pending}>
                  Submit <Send />
                </Button>
              )}
            </div>
          </section>

          <nav aria-label="Question navigation">
            <p className="mb-2 text-xs font-medium text-fg-subtle">Questions</p>
            <div className="grid grid-cols-8 gap-1.5 md:grid-cols-4">
              {items.map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}${isAnswered(entry.id) ? ", answered" : ""}${flagged.includes(entry.id) ? ", flagged" : ""}`}
                  className={cn(
                    "relative h-9 rounded-md border text-[13px] font-medium tabular-nums transition-colors",
                    i === index ? "border-brand ring-2 ring-brand/25" : "border-border",
                    isAnswered(entry.id) ? "bg-brand-soft text-brand-text" : "bg-surface text-fg-muted hover:bg-muted",
                  )}
                >
                  {i + 1}
                  {flagged.includes(entry.id) ? <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber" /> : null}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
}

export function CodingAttempt({
  attemptId,
  title,
  startedAt,
  timeLimitSeconds,
  serverNow,
  exercises,
  initial,
  submissions,
  remoteExecutionEnabled,
  timeZone,
}: {
  attemptId: string;
  title: string;
  startedAt: string;
  timeLimitSeconds: number | null;
  serverNow: number;
  exercises: WorkspaceExercise[];
  initial: Record<string, { code?: string; output?: string; status?: "passed" | "partial" | "failed" }>;
  submissions: Record<string, WorkspaceSubmission[]>;
  remoteExecutionEnabled: boolean;
  timeZone: string;
}) {
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finished = useRef(false);

  const finish = (auto = false) => {
    if (finished.current) return;
    const unsubmitted = exercises.filter((e) => !drafts[e.id]?.status).length;
    if (!auto && !window.confirm(unsubmitted ? `${unsubmitted} exercise(s) have no submission and will score zero. Finish anyway?` : "Finish this assessment and see your results?")) return;
    finished.current = true;
    startTransition(async () => {
      const result = await finishCodingAttempt(attemptId);
      if (result?.error) {
        finished.current = false;
        setError(result.error);
      }
    });
  };

  const { elapsed, remaining } = useClock(startedAt, timeLimitSeconds, serverNow, () => finish(true));

  const exercise = exercises[index];
  const dot = (status?: string) => (status === "passed" ? "bg-success" : status === "partial" ? "bg-amber" : status === "failed" ? "bg-danger" : "bg-border-strong");

  return (
    <div className="flex flex-1 flex-col lg:h-screen">
      {error ? <Notice tone="danger" className="m-3">{error}</Notice> : null}
      <Workspace
        key={exercise.id}
        exercise={exercise}
        attemptId={attemptId}
        initialCode={drafts[exercise.id]?.code}
        initialOutput={drafts[exercise.id]?.output}
        submissions={submissions[exercise.id] ?? []}
        remoteExecutionEnabled={remoteExecutionEnabled}
        timeZone={timeZone}
        onDraft={(draft) => setDrafts((all) => ({ ...all, [exercise.id]: { ...all[exercise.id], ...draft } }))}
        onResult={(result) => setDrafts((all) => ({ ...all, [exercise.id]: { ...all[exercise.id], status: result.status } }))}
        header={
          <>
            <span className="hidden max-w-48 truncate text-sm font-medium md:block">{title}</span>
            <div className="flex items-center gap-1" role="tablist" aria-label="Exercises">
              {exercises.map((entry, i) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Exercise ${i + 1}${drafts[entry.id]?.status ? `, ${drafts[entry.id]?.status}` : ""}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] font-medium tabular-nums",
                    i === index ? "border-brand bg-brand-soft text-brand-text" : "border-border text-fg-muted hover:bg-muted",
                  )}
                >
                  {i + 1}
                  <span className={cn("size-1.5 rounded-full", dot(drafts[entry.id]?.status))} />
                </button>
              ))}
            </div>
            <TimerBadge elapsed={elapsed} remaining={remaining} />
            <DiscardButton attemptId={attemptId} />
            <Button variant="secondary" size="sm" onClick={() => finish()} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null} Finish
            </Button>
          </>
        }
      />
    </div>
  );
}
