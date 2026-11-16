"use client";

// Small create/edit forms used from Server Component pages.
import { useActionState, useEffect, useState } from "react";
import { Lock, Pencil, Play, Plus } from "lucide-react";
import { startAttempt } from "@/app/actions/attempts";
import { createSet, saveSubject, updateDocument, updateSet } from "@/app/actions/library";
import { ActionForm, FormMessage, Modal, SubmitButton } from "@/components/client-ui";
import { ModeIcon } from "@/components/rows";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { MODES, SUBJECT_COLORS, subjectColorClass } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { FormState, StudyMode, StudySet, Subject } from "@/lib/types";

type SubjectOption = Pick<Subject, "id" | "name">;

/** Closes the surrounding modal once a Server Action reports success. */
function useCloseOnSuccess(state: FormState, close: () => void) {
  useEffect(() => {
    if (state?.message) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function SubjectSelect({ subjects, defaultValue }: { subjects: SubjectOption[]; defaultValue?: string | null }) {
  return (
    <Select name="subject_id" defaultValue={defaultValue ?? ""}>
      <option value="">No subject</option>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

export function SubjectFormButton({ subject }: { subject?: Subject }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={subject ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {subject ? <Pencil /> : <Plus />}
        {subject ? "Edit" : "New subject"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={subject ? "Edit subject" : "New subject"}>
        <SubjectForm subject={subject} close={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function SubjectForm({ subject, close }: { subject?: Subject; close: () => void }) {
  const [state, action] = useActionState(saveSubject, null);
  const [color, setColor] = useState(subject?.color ?? "teal");
  useCloseOnSuccess(state, close);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state?.error ? state : null} />
      <input type="hidden" name="id" value={subject?.id ?? ""} />
      <input type="hidden" name="color" value={color} />
      <Field label="Name">
        <Input name="name" defaultValue={subject?.name} placeholder="Data Structures and Algorithms" maxLength={120} required autoFocus />
      </Field>
      <Field label="Course code" hint="Optional.">
        <Input name="code" defaultValue={subject?.code ?? ""} placeholder="CS 201" maxLength={30} />
      </Field>
      <Field label="Description" hint="Optional.">
        <Textarea name="description" defaultValue={subject?.description ?? ""} rows={2} maxLength={500} />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium">Colour</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Colour">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface", subjectColorClass[c], color === c && "ring-2 ring-fg")}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <SubmitButton>{subject ? "Save" : "Create subject"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DocumentEditButton({
  doc,
  subjects,
}: {
  doc: { id: string; title: string; subject_id: string | null };
  subjects: SubjectOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Rename
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit document">
        <DocumentForm doc={doc} subjects={subjects} close={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function DocumentForm({
  doc,
  subjects,
  close,
}: {
  doc: { id: string; title: string; subject_id: string | null };
  subjects: SubjectOption[];
  close: () => void;
}) {
  const [state, action] = useActionState(updateDocument, null);
  useCloseOnSuccess(state, close);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state?.error ? state : null} />
      <input type="hidden" name="id" value={doc.id} />
      <Field label="Title">
        <Input name="title" defaultValue={doc.title} maxLength={200} required autoFocus />
      </Field>
      <Field label="Subject">
        <SubjectSelect subjects={subjects} defaultValue={doc.subject_id} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Study Mode Selection: pick a mode, name the set, attach it to a subject / PDF. */
export function NewSetForm({
  subjects,
  documents,
  isTechnical,
  defaults,
}: {
  subjects: SubjectOption[];
  documents: { id: string; title: string }[];
  isTechnical: boolean;
  defaults: { mode?: string; subjectId?: string; documentId?: string };
}) {
  const [state, action] = useActionState(createSet, null);
  const initialMode = MODES.some((m) => m.id === defaults.mode) && (defaults.mode !== "coding" || isTechnical) ? defaults.mode : "multiple_choice";
  const [mode, setMode] = useState<StudyMode>(initialMode as StudyMode);

  return (
    <ActionForm action={action} className="space-y-6">
      <FormMessage state={state} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Study mode</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => {
            const locked = m.id === "coding" && !isTechnical;
            return (
              <label
                key={m.id}
                className={cn(
                  "relative block rounded-card border p-4 transition-colors",
                  locked ? "cursor-not-allowed border-border bg-muted/50 opacity-70" : "cursor-pointer",
                  !locked && (mode === m.id ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:bg-muted"),
                )}
              >
                <input type="radio" name="mode" value={m.id} checked={mode === m.id} disabled={locked} onChange={() => setMode(m.id)} className="sr-only" />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <ModeIcon mode={m.id} className="size-4 text-brand-text" />
                  {m.label}
                  {locked ? <Lock className="ml-auto size-3.5 text-fg-subtle" /> : null}
                </span>
                <span className="mt-1.5 block text-[13px] leading-relaxed text-fg-muted">
                  {locked ? "Available to technology programs. Change your program in your profile if this applies to you." : m.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input name="title" placeholder="Chapter 3 — Linked Lists" maxLength={200} required />
        </Field>
        <Field label="Subject">
          <SubjectSelect subjects={subjects} defaultValue={defaults.subjectId} />
        </Field>
        <Field label="Source PDF" hint="Optional. Links the set to a document in your library.">
          <Select name="document_id" defaultValue={defaults.documentId ?? ""}>
            <option value="">None</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" hint="Optional." className="sm:col-span-2">
          <Textarea name="description" rows={2} maxLength={1000} />
        </Field>
      </div>
      <SubmitButton size="lg">Create and add {mode === "coding" ? "exercises" : "questions"}</SubmitButton>
    </ActionForm>
  );
}

export function SetSettingsForm({ set, subjects }: { set: StudySet; subjects: SubjectOption[] }) {
  const [state, action] = useActionState(updateSet, null);
  return (
    <ActionForm action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={set.id} />
      <Field label="Title">
        <Input name="title" defaultValue={set.title} maxLength={200} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={set.description ?? ""} rows={2} maxLength={1000} />
      </Field>
      <Field label="Subject">
        <SubjectSelect subjects={subjects} defaultValue={set.subject_id} />
      </Field>
      <Field label="Default time limit (minutes)" hint="Leave empty for untimed. You can still choose per attempt.">
        <Input name="time_limit_minutes" type="number" min={1} max={600} defaultValue={set.time_limit_minutes ?? ""} className="max-w-32" />
      </Field>
      {set.mode !== "coding" ? (
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="shuffle_questions" defaultChecked={set.shuffle_questions} className="accent-(--brand)" />
            Randomize question order
          </label>
          {set.mode === "multiple_choice" ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="shuffle_options" defaultChecked={set.shuffle_options} className="accent-(--brand)" />
              Randomize answer order
            </label>
          ) : null}
        </div>
      ) : null}
      <SubmitButton variant="secondary">Save settings</SubmitButton>
    </ActionForm>
  );
}

export function StartAttemptForm({ setId, defaultMinutes, label = "Start assessment" }: { setId: string; defaultMinutes: number | null; label?: string }) {
  const [timed, setTimed] = useState(defaultMinutes != null);
  return (
    <form action={startAttempt.bind(null, setId)} className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="timed" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="accent-(--brand)" />
        Timed assessment
      </label>
      {timed ? (
        <Field label="Time limit (minutes)">
          <Input name="minutes" type="number" min={1} max={600} defaultValue={defaultMinutes ?? 15} className="max-w-28" required />
        </Field>
      ) : null}
      <SubmitButton size="lg" className="w-full">
        <Play /> {label}
      </SubmitButton>
    </form>
  );
}
