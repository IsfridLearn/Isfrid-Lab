"use client";

// Coding Exercise Editor: the author writes the code, marks the blanks and supplies the answer key.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Plus, SquareDashed, Trash2, X } from "lucide-react";
import { deleteExercise, saveExercise } from "@/app/actions/content";
import { CodeEditor, type EditorInstance } from "@/components/code-editor";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { blankNumbers, fillBlanks } from "@/lib/grading";
import { EXERCISE_TYPES, LANGUAGES, languageInfo, VALIDATIONS } from "@/lib/languages";
import { runCode } from "@/lib/runner";
import type { CodingExercise, ExerciseType, LanguageId, Validation } from "@/lib/types";

const ANSWER_SEPARATOR = /\n\s*---\s*\n/;

interface TestDraft {
  key: number;
  stdin: string;
  expected_output: string;
  is_hidden: boolean;
}
let nextKey = 1;

export function DeleteExerciseButton({ id, setId }: { id: string; setId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this exercise and its submission history?")) startTransition(async () => void (await deleteExercise(id, setId)));
      }}
      className="rounded-md p-2 text-fg-subtle hover:bg-danger-soft hover:text-danger"
      aria-label="Delete exercise"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}

function EditorFrame({ label, hint, action, children, height = 260 }: { label: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; height?: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div>
          <span className="block text-[13px] font-medium">{label}</span>
          {hint ? <span className="block text-xs text-fg-subtle">{hint}</span> : null}
        </div>
        {action}
      </div>
      <div className="overflow-hidden rounded-lg border border-border-strong" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export function ExerciseEditor({
  setId,
  exercise,
  remoteExecutionEnabled,
}: {
  setId: string;
  exercise?: CodingExercise;
  remoteExecutionEnabled: boolean;
}) {
  const router = useRouter();
  const templateEditor = useRef<EditorInstance | null>(null);
  const [title, setTitle] = useState(exercise?.title ?? "");
  const [exerciseType, setExerciseType] = useState<ExerciseType>(exercise?.exercise_type ?? "missing_code");
  const [language, setLanguage] = useState<LanguageId>(exercise?.language ?? "python");
  const [validation, setValidation] = useState<Validation>(exercise?.validation ?? "blanks");
  const [points, setPoints] = useState(exercise?.points ?? 10);
  const [description, setDescription] = useState(exercise?.description ?? "");
  const [instructions, setInstructions] = useState(exercise?.instructions ?? "");
  const [hints, setHints] = useState((exercise?.hints ?? []).join("\n"));
  const [template, setTemplate] = useState(exercise?.template_code ?? "");
  const [solution, setSolution] = useState(exercise?.solution_code ?? "");
  const [setup, setSetup] = useState(exercise?.setup_code ?? "");
  const [expectedOutput, setExpectedOutput] = useState(exercise?.expected_output ?? "");
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries((exercise?.blanks ?? []).map((b) => [b.n, b.answers.join("\n---\n")])),
  );
  const [tests, setTests] = useState<TestDraft[]>(() =>
    [...(exercise?.coding_test_cases ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ key: nextKey++, stdin: t.stdin, expected_output: t.expected_output, is_hidden: t.is_hidden })),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();

  const info = languageInfo(language);
  const canRun = info.runtime === "browser" || remoteExecutionEnabled;
  const numbers = blankNumbers(template);
  const parsedBlanks = numbers.map((n) => ({ n, answers: (answers[n] ?? "").split(ANSWER_SEPARATOR).map((a) => a.trim()).filter(Boolean) }));
  const isSql = language === "sql";
  const reference = validation === "blanks" ? fillBlanks(template, parsedBlanks) : validation === "output" ? template : solution;

  const changeType = (next: ExerciseType) => {
    setExerciseType(next);
    setValidation(EXERCISE_TYPES.find((t) => t.id === next)!.defaultValidation);
  };

  const makeBlank = () => {
    const editor = templateEditor.current;
    const model = editor?.getModel();
    const selection = editor?.getSelection();
    if (!editor || !model || !selection || selection.isEmpty()) {
      setNotice("Select the code you want to hide in the starter code first, then press Make blank.");
      return;
    }
    const n = Math.max(0, ...blankNumbers(model.getValue())) + 1;
    const hidden = model.getValueInRange(selection);
    editor.executeEdits("make-blank", [{ range: selection, text: `__${n}__` }]);
    setAnswers((current) => ({ ...current, [n]: hidden.trim() }));
    setNotice(null);
  };

  const runReference = async (stdin: string) => {
    const result = await runCode({ language, code: reference, stdin, setup });
    if (result.error) throw new Error(result.error);
    if (result.timedOut) throw new Error("The reference program timed out.");
    if (result.exitCode !== 0 && result.stderr.trim()) throw new Error(`The reference program failed:\n${result.stderr.trim()}`);
    return result.stdout;
  };

  const fillExpected = async () => {
    setError(null);
    setNotice(null);
    if (!reference.trim()) return setError(validation === "tests" ? "Write the reference solution first." : "Write the program first.");
    setRunning(true);
    try {
      if (validation === "output") {
        setExpectedOutput(await runReference(""));
      } else {
        const outputs: string[] = [];
        for (const test of tests) outputs.push(await runReference(test.stdin));
        setTests((list) => list.map((t, i) => ({ ...t, expected_output: outputs[i] })));
      }
      setNotice("Expected output filled in from an actual run. Check it before saving.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run the reference program.");
    } finally {
      setRunning(false);
    }
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveExercise({
        id: exercise?.id,
        setId,
        title,
        exerciseType,
        language,
        description,
        instructions,
        hints: hints.split("\n"),
        templateCode: template,
        solutionCode: validation === "blanks" ? fillBlanks(template, parsedBlanks) : solution,
        setupCode: isSql ? setup : "",
        validation,
        blanks: parsedBlanks,
        expectedOutput,
        points,
        testCases: validation === "tests" ? tests.map(({ stdin, expected_output, is_hidden }) => ({ stdin, expected_output, is_hidden })) : [],
      });
      if (!result.ok) return setError(result.error);
      router.push(`/sets/${setId}/edit`);
    });
  };

  const fillButton = (
    <Button type="button" variant="secondary" size="sm" onClick={fillExpected} disabled={running || !canRun} title={canRun ? undefined : "No runtime is configured for this language"}>
      {running ? <Loader2 className="animate-spin" /> : <Play />} Fill from a real run
    </Button>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Sum of an array" />
        </Field>
        <Field label="Exercise type" hint={EXERCISE_TYPES.find((t) => t.id === exerciseType)?.hint}>
          <Select value={exerciseType} onChange={(e) => changeType(e.target.value as ExerciseType)}>
            {EXERCISE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value as LanguageId)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Points">
            <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="How answers are checked" hint={VALIDATIONS.find((v) => v.id === validation)?.description}>
          <Select value={validation} onChange={(e) => setValidation(e.target.value as Validation)}>
            {VALIDATIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        {validation === "tests" && !canRun ? (
          <Notice tone="amber">
            {info.label} needs a code execution service, and none is configured for this deployment. Students won&apos;t be able to run or
            submit this exercise until one is set up — or choose a check that doesn&apos;t execute code.
          </Notice>
        ) : null}
        <Field label="Problem description" hint="Shown on the left of the workspace.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={8000} />
        </Field>
        <Field label="Instructions" hint="Shown on the right. Optional.">
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} maxLength={4000} />
        </Field>
        <Field label="Hints" hint="One per line. Students reveal them one at a time.">
          <Textarea value={hints} onChange={(e) => setHints(e.target.value)} rows={3} />
        </Field>
      </div>

      <div className="min-w-0 space-y-6">
        {error ? <Notice tone="danger" className="whitespace-pre-wrap">{error}</Notice> : null}
        {notice ? <Notice tone="brand">{notice}</Notice> : null}

        {isSql ? (
          <EditorFrame label="Database setup (SQL)" hint="Tables and rows created before the student's query runs. SQLite syntax." height={180}>
            <CodeEditor language="sql" value={setup} onChange={setSetup} />
          </EditorFrame>
        ) : null}

        <EditorFrame
          label={validation === "output" ? "Program shown to the student" : exerciseType === "debug" ? "Broken code the student starts with" : "Starter code"}
          hint={
            validation === "blanks"
              ? "Write the full working code, select a part, and press Make blank. Blanks appear as __1__, __2__ …"
              : validation === "output"
                ? "Read-only for the student. They can't run it."
                : "What the editor contains when the student opens the exercise."
          }
          action={
            validation === "blanks" ? (
              <Button type="button" variant="secondary" size="sm" onClick={makeBlank}>
                <SquareDashed /> Make blank from selection
              </Button>
            ) : null
          }
          height={300}
        >
          <CodeEditor language={language} value={template} onChange={setTemplate} onMount={(editor) => (templateEditor.current = editor)} />
        </EditorFrame>

        {validation === "blanks" ? (
          <div>
            <span className="block text-[13px] font-medium">Accepted answers for each blank</span>
            <p className="mb-2 text-xs text-fg-subtle">
              Spacing around symbols is ignored (<code className="font-mono">i+1</code> matches <code className="font-mono">i + 1</code>). To accept
              alternatives, separate them with a line containing only <code className="font-mono">---</code>.
            </p>
            {numbers.length === 0 ? (
              <p className="text-sm text-fg-muted">No blanks yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {numbers.map((n) => (
                  <label key={n} className="block">
                    <span className="mb-1 block font-mono text-xs text-fg-muted">__{n}__</span>
                    <Textarea
                      value={answers[n] ?? ""}
                      onChange={(e) => setAnswers((current) => ({ ...current, [n]: e.target.value }))}
                      rows={Math.min(6, Math.max(2, (answers[n] ?? "").split("\n").length))}
                      className="font-mono text-[13px]"
                      spellCheck={false}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {validation === "output" ? (
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <span className="block text-[13px] font-medium">Expected output</span>
              {fillButton}
            </div>
            <Textarea value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} rows={5} className="font-mono text-[13px]" spellCheck={false} />
          </div>
        ) : null}

        {validation === "tests" || validation === "solution" ? (
          <EditorFrame
            label="Reference solution"
            hint={validation === "solution" ? "The student's code must match this (ignoring spacing)." : "Optional. Used to fill expected outputs, and shown in the answer review."}
            height={260}
          >
            <CodeEditor language={language} value={solution} onChange={setSolution} />
          </EditorFrame>
        ) : null}

        {validation === "tests" ? (
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <span className="block text-[13px] font-medium">Test cases</span>
                <span className="block text-xs text-fg-subtle">
                  {isSql ? "The query result is compared with the expected output (columns and values separated by |)." : "Each test feeds the input to the program and compares what it prints."}
                </span>
              </div>
              {tests.length ? fillButton : null}
            </div>
            <div className="space-y-3">
              {tests.map((test, index) => (
                <div key={test.key} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-fg-muted">Test {index + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <input
                          type="checkbox"
                          checked={test.is_hidden}
                          onChange={(e) => setTests((list) => list.map((t) => (t.key === test.key ? { ...t, is_hidden: e.target.checked } : t)))}
                          className="accent-(--brand)"
                        />
                        Hidden from student
                      </label>
                      <button type="button" onClick={() => setTests((list) => list.filter((t) => t.key !== test.key))} className="rounded p-1 text-fg-subtle hover:bg-muted hover:text-fg" aria-label={`Remove test ${index + 1}`}>
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {isSql ? null : (
                      <Textarea
                        value={test.stdin}
                        onChange={(e) => setTests((list) => list.map((t) => (t.key === test.key ? { ...t, stdin: e.target.value } : t)))}
                        rows={3}
                        placeholder="Input (stdin)"
                        className="font-mono text-[13px]"
                        spellCheck={false}
                      />
                    )}
                    <Textarea
                      value={test.expected_output}
                      onChange={(e) => setTests((list) => list.map((t) => (t.key === test.key ? { ...t, expected_output: e.target.value } : t)))}
                      rows={3}
                      placeholder="Expected output"
                      className={isSql ? "font-mono text-[13px] sm:col-span-2" : "font-mono text-[13px]"}
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
            </div>
            {tests.length < 10 ? (
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setTests((list) => [...list, { key: nextKey++, stdin: "", expected_output: "", is_hidden: false }])}>
                <Plus /> Add test case
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => router.push(`/sets/${setId}/edit`)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {exercise ? "Save exercise" : "Create exercise"}
          </Button>
        </div>
      </div>
    </div>
  );
}
