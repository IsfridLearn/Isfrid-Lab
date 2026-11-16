"use client";

// Multiple Choice and Identification editors. Students write every question by hand.
import { useImperativeHandle, useState, useTransition, type Ref } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteQuestion, saveQuestion } from "@/app/actions/content";
import { Badge, Button, Field, Input, Notice, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Question } from "@/lib/types";

type Mode = "multiple_choice" | "identification";
interface OptionDraft {
  key: number;
  body: string;
  is_correct: boolean;
}

export interface QuestionFormHandle {
  insert: (field: "prompt" | "answer", text: string) => void;
}

let nextKey = 1;
const blankOption = (): OptionDraft => ({ key: nextKey++, body: "", is_correct: false });

export function QuestionForm({
  setId,
  mode,
  question,
  seed,
  source,
  onSaved,
  onCancel,
  ref,
}: {
  ref?: Ref<QuestionFormHandle>;
  setId: string;
  mode: Mode;
  question?: Question;
  seed?: { prompt?: string; answer?: string };
  source?: { documentId: string; page: number };
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [prompt, setPrompt] = useState(question?.prompt ?? seed?.prompt ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    question?.answer_options.length
      ? [...question.answer_options].sort((a, b) => a.position - b.position).map((o) => ({ key: nextKey++, body: o.body, is_correct: o.is_correct }))
      : [{ key: nextKey++, body: seed?.answer ?? "", is_correct: Boolean(seed?.answer) }, blankOption(), blankOption(), blankOption()],
  );
  const [accepted, setAccepted] = useState<{ key: number; body: string }[]>(() =>
    question?.accepted_answers.length
      ? question.accepted_answers.map((a) => ({ key: nextKey++, body: a.body }))
      : [{ key: nextKey++, body: seed?.answer ?? "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({
    insert(field, text) {
      if (field === "prompt") {
        setPrompt((current) => (current.trim() ? `${current.trim()} ${text}` : text));
      } else if (mode === "multiple_choice") {
        setOptions((list) => {
          const empty = list.find((o) => !o.body.trim());
          const filled = { body: text.slice(0, 1000), is_correct: !list.some((o) => o.is_correct) };
          return empty ? list.map((o) => (o === empty ? { ...o, ...filled } : o)) : [...list, { key: nextKey++, ...filled }];
        });
      } else {
        setAccepted((list) => {
          const empty = list.find((a) => !a.body.trim());
          const body = text.slice(0, 500);
          return empty ? list.map((a) => (a === empty ? { ...a, body } : a)) : [...list, { key: nextKey++, body }];
        });
      }
    },
  }));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveQuestion({
        id: question?.id,
        setId,
        prompt,
        explanation,
        points,
        options: options.map(({ body, is_correct }) => ({ body, is_correct })),
        accepted: accepted.map((a) => a.body),
        sourceDocumentId: source?.documentId,
        sourcePage: source?.page,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!question) {
        setPrompt("");
        setExplanation("");
        setOptions([blankOption(), blankOption(), blankOption(), blankOption()]);
        setAccepted([{ key: nextKey++, body: "" }]);
      }
      onSaved?.();
    });
  };

  return (
    <div className="space-y-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Question">
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={4000} placeholder="Write the question in your own words" />
      </Field>

      {mode === "multiple_choice" ? (
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Answer choices</span>
          <p className="mb-2 text-xs text-fg-subtle">Tick the correct choice. Tick more than one to make it &quot;select all that apply&quot;.</p>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={option.key} className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={option.is_correct}
                  aria-label={`Mark choice ${index + 1} as correct`}
                  onClick={() => setOptions((list) => list.map((o) => (o.key === option.key ? { ...o, is_correct: !o.is_correct } : o)))}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    option.is_correct ? "border-success bg-success-soft text-success" : "border-border-strong text-transparent hover:text-fg-subtle",
                  )}
                >
                  <Check className="size-4" />
                </button>
                <Input
                  value={option.body}
                  onChange={(e) => setOptions((list) => list.map((o) => (o.key === option.key ? { ...o, body: e.target.value } : o)))}
                  placeholder={`Choice ${index + 1}`}
                  maxLength={1000}
                />
                <button
                  type="button"
                  onClick={() => setOptions((list) => list.filter((o) => o.key !== option.key))}
                  disabled={options.length <= 2}
                  className="rounded-md p-2 text-fg-subtle hover:bg-muted hover:text-fg disabled:opacity-30"
                  aria-label={`Remove choice ${index + 1}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          {options.length < 8 ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setOptions((list) => [...list, blankOption()])}>
              <Plus /> Add choice
            </Button>
          ) : null}
        </div>
      ) : (
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Accepted answers</span>
          <p className="mb-2 text-xs text-fg-subtle">
            Any of these counts as correct. Capital letters and extra spaces are ignored, so &quot;Stack&quot; matches &quot;stack&quot;.
          </p>
          <div className="space-y-2">
            {accepted.map((answer, index) => (
              <div key={answer.key} className="flex items-center gap-2">
                <Input
                  value={answer.body}
                  onChange={(e) => setAccepted((list) => list.map((a) => (a.key === answer.key ? { ...a, body: e.target.value } : a)))}
                  placeholder={index === 0 ? "Correct answer" : "Another accepted answer (synonym, abbreviation…)"}
                  maxLength={500}
                />
                <button
                  type="button"
                  onClick={() => setAccepted((list) => list.filter((a) => a.key !== answer.key))}
                  disabled={accepted.length <= 1}
                  className="rounded-md p-2 text-fg-subtle hover:bg-muted hover:text-fg disabled:opacity-30"
                  aria-label={`Remove answer ${index + 1}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAccepted((list) => [...list, { key: nextKey++, body: "" }])}>
            <Plus /> Add accepted answer
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field label="Explanation" hint="Optional. Shown when reviewing answers.">
          <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={4000} />
        </Field>
        <Field label="Points">
          <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {question ? "Save question" : "Add question"}
        </Button>
      </div>
    </div>
  );
}

export function QuestionList({ setId, mode, questions }: { setId: string; mode: Mode; questions: Question[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <div key={question.id} className="rounded-card border border-border bg-surface p-4">
          {editing === question.id ? (
            <QuestionForm setId={setId} mode={mode} question={question} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex gap-3">
              <span className="font-mono text-xs leading-6 text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium whitespace-pre-wrap">{question.prompt}</p>
                {mode === "multiple_choice" ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {[...question.answer_options]
                      .sort((a, b) => a.position - b.position)
                      .map((option) => (
                        <li key={option.id} className={cn("flex items-start gap-2", option.is_correct ? "text-success" : "text-fg-muted")}>
                          {option.is_correct ? <Check className="mt-0.5 size-4 shrink-0" /> : <span className="mt-2 ml-1.5 size-1 shrink-0 rounded-full bg-fg-subtle" />}
                          <span className={option.is_correct ? "" : "ml-1.5"}>{option.body}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {question.accepted_answers.map((answer) => (
                      <Badge key={answer.id} tone="success">
                        {answer.body}
                      </Badge>
                    ))}
                  </div>
                )}
                {question.source_page ? <p className="mt-2 text-xs text-fg-subtle">From PDF page {question.source_page}</p> : null}
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <button type="button" onClick={() => setEditing(question.id)} className="rounded-md p-2 text-fg-subtle hover:bg-muted hover:text-fg" aria-label="Edit question">
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Delete this question?")) startTransition(async () => void (await deleteQuestion(question.id, setId)));
                  }}
                  className="rounded-md p-2 text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  aria-label="Delete question"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="rounded-card border border-dashed border-border-strong bg-surface p-4">
        <p className="mb-4 text-sm font-semibold">{questions.length === 0 ? "Write your first question" : "Add another question"}</p>
        <QuestionForm setId={setId} mode={mode} />
      </div>
    </div>
  );
}
