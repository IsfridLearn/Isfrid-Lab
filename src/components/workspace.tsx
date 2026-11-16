"use client";

// ISFRID CodeLab workspace: problem, editor, console and test results, instructions and hints.
import { useState, type ReactNode } from "react";
import { CheckCircle2, CircleDashed, Lightbulb, Loader2, Play, RotateCcw, Send, XCircle } from "lucide-react";
import { submitCoding, type ClientRun } from "@/app/actions/attempts";
import { CodeEditor } from "@/components/code-editor";
import { Badge, Button, Notice, Textarea } from "@/components/ui";
import { outputsMatch } from "@/lib/grading";
import { exerciseTypeLabel, LANGUAGES, languageInfo } from "@/lib/languages";
import { runCode, type RunResult } from "@/lib/runner";
import { cn } from "@/lib/utils";
import type { CheckResult, SubmissionResult } from "@/lib/types";
import type { WorkspaceExercise, WorkspaceSubmission } from "@/lib/workspace";

type Tab = "answer" | "console" | "tests" | "result" | "history";

export function ConsoleOutput({ result, running, idle }: { result: RunResult | null; running: boolean; idle: string }) {
  if (running) {
    return (
      <p className="flex items-center gap-2 text-white/60">
        <Loader2 className="size-3.5 animate-spin" /> Running…
      </p>
    );
  }
  if (!result) return <p className="text-white/40">{idle}</p>;
  if (result.error) return <p className="whitespace-pre-wrap text-amber-300">{result.error}</p>;
  return (
    <>
      {result.stdout ? <pre className="whitespace-pre-wrap text-code-fg">{result.stdout}</pre> : null}
      {result.stderr ? <pre className="whitespace-pre-wrap text-rose-300">{result.stderr}</pre> : null}
      {!result.stdout && !result.stderr ? <p className="text-white/40">(no output)</p> : null}
      <p className="mt-2 text-white/35">
        {result.timedOut ? "Stopped: time limit exceeded" : `Exited with code ${result.exitCode ?? "?"}`}
      </p>
    </>
  );
}

function CheckList({ checks }: { checks: CheckResult[] }) {
  return (
    <ul className="space-y-2">
      {checks.map((check, index) => (
        <li key={index} className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {check.passed ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}
            {check.label}
            <span className={cn("ml-auto text-xs", check.passed ? "text-success" : "text-danger")}>{check.passed ? "Passed" : "Failed"}</span>
          </div>
          {!check.hidden && (check.stdin || check.expected != null || check.actual != null || check.error) ? (
            <dl className="mt-2 grid gap-2 font-mono text-xs sm:grid-cols-3">
              {check.stdin ? (
                <div>
                  <dt className="mb-1 font-sans text-fg-subtle">Input</dt>
                  <dd className="rounded bg-muted p-2 whitespace-pre-wrap">{check.stdin}</dd>
                </div>
              ) : null}
              {check.expected != null ? (
                <div>
                  <dt className="mb-1 font-sans text-fg-subtle">Expected</dt>
                  <dd className="rounded bg-muted p-2 whitespace-pre-wrap">{check.expected || "(empty)"}</dd>
                </div>
              ) : null}
              {check.actual != null ? (
                <div>
                  <dt className="mb-1 font-sans text-fg-subtle">Your {check.expected != null ? "output" : "answer"}</dt>
                  <dd className="rounded bg-muted p-2 whitespace-pre-wrap">{check.actual || "(empty)"}</dd>
                </div>
              ) : null}
              {check.error ? <dd className="rounded bg-danger-soft p-2 whitespace-pre-wrap text-danger sm:col-span-3">{check.error}</dd> : null}
            </dl>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ResultSummary({ result, points }: { result: SubmissionResult; points: number }) {
  const tone = result.status === "passed" ? "success" : result.status === "partial" ? "amber" : "danger";
  return (
    <div className="space-y-3">
      <Notice tone={tone}>
        <span className="font-medium">
          {result.status === "passed" ? "Correct." : result.status === "partial" ? "Partly correct." : "Not correct yet."}
        </span>{" "}
        {result.total > 0 ? `${result.passed} of ${result.total} checks passed · ` : ""}
        {Math.round(result.score * points * 100) / 100} / {points} points
      </Notice>
      {result.message ? <p className="text-sm text-fg-muted">{result.message}</p> : null}
      {result.checks.length ? <CheckList checks={result.checks} /> : null}
    </div>
  );
}

export function Workspace({
  exercise,
  initialCode,
  initialOutput,
  submissions,
  attemptId,
  remoteExecutionEnabled,
  header,
  timeZone = "UTC",
  onDraft,
  onResult,
}: {
  exercise: WorkspaceExercise;
  initialCode?: string;
  initialOutput?: string;
  submissions: WorkspaceSubmission[];
  attemptId?: string;
  remoteExecutionEnabled: boolean;
  header?: ReactNode;
  timeZone?: string;
  onDraft?: (draft: { code: string; output: string }) => void;
  onResult?: (result: SubmissionResult) => void;
}) {
  const info = languageInfo(exercise.language);
  const predict = exercise.validation === "output";
  const canRun = !predict && (info.runtime === "browser" || remoteExecutionEnabled);
  const visibleTests = exercise.tests.filter((t) => !t.is_hidden);

  const [code, setCode] = useState(initialCode ?? exercise.template_code);
  const [outputAnswer, setOutputAnswer] = useState(initialOutput ?? "");
  const [stdin, setStdin] = useState(visibleTests[0]?.stdin ?? "");
  const [tab, setTab] = useState<Tab>(predict ? "answer" : "console");
  const [consoleResult, setConsoleResult] = useState<RunResult | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { passed: boolean; run: RunResult }>>({});
  const [busy, setBusy] = useState<"run" | "tests" | "submit" | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [history, setHistory] = useState(submissions);
  const [hintsShown, setHintsShown] = useState(0);

  const updateCode = (next: string) => {
    setCode(next);
    onDraft?.({ code: next, output: outputAnswer });
  };
  const updateOutput = (next: string) => {
    setOutputAnswer(next);
    onDraft?.({ code, output: next });
  };
  const execute = (input: string) => runCode({ language: exercise.language, code, stdin: input, setup: exercise.setup_code });

  const run = async () => {
    setTab("console");
    setBusy("run");
    setConsoleResult(await execute(stdin));
    setBusy(null);
  };

  const runTests = async () => {
    setTab("tests");
    setBusy("tests");
    const next: typeof testResults = {};
    for (const test of visibleTests) {
      const outcome = await execute(test.stdin);
      next[test.id] = { run: outcome, passed: !outcome.error && !outcome.timedOut && outputsMatch(outcome.stdout, test.expected_output ?? "") };
      setTestResults({ ...next });
      if (outcome.error) break;
    }
    setBusy(null);
  };

  const submit = async () => {
    setBusy("submit");
    setSubmitError(null);
    let clientRuns: ClientRun[] | undefined;
    if (exercise.validation === "tests" && info.runtime === "browser") {
      clientRuns = [];
      for (const test of exercise.tests) {
        const outcome = await execute(test.stdin);
        clientRuns.push({ testId: test.id, stdout: outcome.stdout, stderr: outcome.stderr, exitCode: outcome.exitCode, timedOut: outcome.timedOut, error: outcome.error });
      }
    }
    const response = await submitCoding({ exerciseId: exercise.id, attemptId, code, outputAnswer, clientRuns }).catch(() => ({
      ok: false as const,
      error: "Could not reach the server. Check your connection and submit again.",
    }));
    if (response.ok) {
      setResult(response.result);
      setHistory((list) => [
        {
          id: crypto.randomUUID(),
          status: response.result.status,
          passed_count: response.result.passed,
          total_count: response.result.total,
          code: predict ? outputAnswer : code,
          created_at: new Date().toISOString(),
        },
        ...list,
      ]);
      onResult?.(response.result);
    } else {
      setResult(null);
      setSubmitError(response.error);
    }
    setTab("result");
    setBusy(null);
  };

  const reset = () => {
    if (code !== exercise.template_code && !window.confirm("Reset the editor to the starter code? Your changes will be lost.")) return;
    updateCode(exercise.template_code);
    setConsoleResult(null);
    setTestResults({});
  };

  const tabs: { id: Tab; label: string }[] = [
    ...(predict ? [{ id: "answer" as const, label: "Your answer" }] : [{ id: "console" as const, label: "Console" }]),
    ...(visibleTests.length ? [{ id: "tests" as const, label: `Test cases (${visibleTests.length})` }] : []),
    { id: "result", label: "Results" },
    { id: "history", label: `Submissions (${history.length})` },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
        <select value={exercise.language} disabled aria-label="Language" title="The language is set by the exercise" className="h-8 w-32 shrink-0 rounded-md border border-border-strong bg-surface px-2 text-[13px] text-fg focus:border-brand focus:outline-none disabled:opacity-70">
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        {!predict ? (
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy !== null}>
            <RotateCcw /> Reset
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={run}
          disabled={busy !== null || !canRun}
          title={predict ? "Running is disabled: work out the output yourself" : canRun ? undefined : "No runtime is configured for this language"}
        >
          {busy === "run" ? <Loader2 className="animate-spin" /> : <Play />} Run
        </Button>
        <Button size="sm" onClick={submit} disabled={busy !== null}>
          {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />} Submit
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)_16rem]">
        <section className="overflow-y-auto border-b border-border p-5 lg:border-r lg:border-b-0" aria-label="Problem">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{exerciseTypeLabel(exercise.exercise_type)}</Badge>
            <Badge>{exercise.points} pts</Badge>
          </div>
          <h1 className="text-lg font-semibold">{exercise.title}</h1>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
            {exercise.description || "No description was written for this exercise."}
          </p>
          {exercise.setup_code.trim() ? (
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-medium text-fg-subtle">Database schema</p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{exercise.setup_code.trim()}</pre>
            </div>
          ) : null}
        </section>

        <section className="flex min-h-[36rem] min-w-0 flex-col lg:min-h-0" aria-label="Editor">
          <div className="min-h-56 flex-1">
            <CodeEditor language={exercise.language} value={code} onChange={updateCode} readOnly={predict} />
          </div>
          <div className="flex h-64 shrink-0 flex-col border-t border-border lg:h-[38%]">
            <div className="flex gap-1 border-b border-border bg-surface px-2" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                    tab === t.id ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "console" ? (
              <div className="flex min-h-0 flex-1 flex-col bg-code-bg sm:flex-row">
                {exercise.language !== "sql" ? (
                  <label className="flex shrink-0 flex-col border-b border-white/10 sm:w-52 sm:border-r sm:border-b-0">
                    <span className="px-3 pt-2 text-[11px] tracking-wide text-white/40 uppercase">Input (stdin)</span>
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      spellCheck={false}
                      className="min-h-12 flex-1 resize-none bg-transparent px-3 py-1.5 font-mono text-xs text-code-fg placeholder:text-white/25 focus:outline-none"
                      placeholder="Typed input for your program"
                    />
                  </label>
                ) : null}
                <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed" aria-live="polite">
                  <ConsoleOutput
                    result={consoleResult}
                    running={busy === "run"}
                    idle={
                      canRun
                        ? "Press Run to execute your code. Output appears here."
                        : `${info.label} runs on a code execution service, and none is configured for this deployment. You can still Submit: this exercise is checked ${exercise.validation === "tests" ? "by running tests, which also needs the service" : "without running code"}.`
                    }
                  />
                </div>
              </div>
            ) : null}

            {tab === "answer" ? (
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <p className="mb-2 text-xs text-fg-muted">Read the program and type exactly what it prints. Trailing spaces and blank lines at the end are ignored.</p>
                <Textarea
                  value={outputAnswer}
                  onChange={(e) => updateOutput(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="font-mono text-[13px]"
                  placeholder="Predicted output"
                />
              </div>
            ) : null}

            {tab === "tests" ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-fg-muted">
                    {exercise.tests.length - visibleTests.length > 0 ? `${exercise.tests.length - visibleTests.length} more hidden test(s) run when you submit.` : "Submitting runs these same tests."}
                  </p>
                  <Button variant="secondary" size="sm" onClick={runTests} disabled={busy !== null || !canRun}>
                    {busy === "tests" ? <Loader2 className="animate-spin" /> : <Play />} Run tests
                  </Button>
                </div>
                <CheckList
                  checks={visibleTests.map((test, index) => {
                    const outcome = testResults[test.id];
                    return {
                      label: `Test ${index + 1}${outcome ? "" : " · not run yet"}`,
                      passed: outcome?.passed ?? false,
                      stdin: test.stdin,
                      expected: test.expected_output ?? "",
                      actual: outcome ? outcome.run.stdout : undefined,
                      error: outcome ? (outcome.run.error ?? (outcome.run.timedOut ? "Time limit exceeded." : outcome.run.stderr.trim() || undefined)) : undefined,
                    };
                  })}
                />
              </div>
            ) : null}

            {tab === "result" ? (
              <div className="min-h-0 flex-1 overflow-auto p-3" aria-live="polite">
                {busy === "submit" ? (
                  <p className="flex items-center gap-2 text-sm text-fg-muted">
                    <Loader2 className="size-4 animate-spin" /> Checking your answer…
                  </p>
                ) : submitError ? (
                  <Notice tone="danger">{submitError}</Notice>
                ) : result ? (
                  <ResultSummary result={result} points={exercise.points} />
                ) : (
                  <p className="text-sm text-fg-muted">Submit to have your answer checked and scored.</p>
                )}
              </div>
            ) : null}

            {tab === "history" ? (
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {history.length === 0 ? (
                  <p className="text-sm text-fg-muted">No submissions yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                    {history.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {entry.status === "passed" ? <CheckCircle2 className="size-4 text-success" /> : entry.status === "partial" ? <CircleDashed className="size-4 text-amber" /> : <XCircle className="size-4 text-danger" />}
                        <span className="tabular-nums">
                          {entry.passed_count}/{entry.total_count} checks
                        </span>
                        <span className="flex-1 text-xs text-fg-subtle">
                          {new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(entry.created_at))}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => (predict ? updateOutput(entry.code) : updateCode(entry.code))}>
                          Load
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-y-auto border-t border-border p-5 lg:border-t-0 lg:border-l" aria-label="Instructions and hints">
          <h2 className="text-sm font-semibold">Instructions</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
            {exercise.instructions ||
              (exercise.validation === "blanks"
                ? `Replace each blank marker (__1__ … __${exercise.blankCount}__) with the missing code. Don't change anything else.`
                : predict
                  ? "Trace the program by hand and enter its exact output."
                  : exercise.validation === "tests"
                    ? "Make the program produce the expected output for every test case."
                    : "Edit the code until it matches the correct program.")}
          </p>
          <p className="mt-3 text-xs text-fg-subtle">
            {exercise.validation === "tests"
              ? info.runtime === "browser"
                ? `Runs in your browser's sandbox${exercise.language === "javascript" ? ". Read input with readline()." : exercise.language === "python" ? ". Read input with input()." : " (SQLite)."}`
                : "Runs on an isolated execution service."
              : "Checked by exact comparison — your code is not executed to grade it."}
          </p>

          {exercise.hints.length ? (
            <div className="mt-6">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Lightbulb className="size-4 text-amber" /> Hints
              </h2>
              <ol className="mt-2 space-y-2">
                {exercise.hints.slice(0, hintsShown).map((hint, index) => (
                  <li key={index} className="rounded-lg bg-amber-soft p-3 text-sm text-fg">
                    <span className="mr-1.5 font-mono text-xs text-amber">{index + 1}</span>
                    {hint}
                  </li>
                ))}
              </ol>
              {hintsShown < exercise.hints.length ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setHintsShown((n) => n + 1)}>
                  Show hint {hintsShown + 1} of {exercise.hints.length}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
