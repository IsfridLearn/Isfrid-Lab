"use client";

// "Generate from PDF" panel: drafts questions from a PDF's definitions; the student reviews them before saving.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Wand2 } from "lucide-react";
import { saveQuestion } from "@/app/actions/content";
import { getDocumentText } from "@/app/actions/library";
import { Badge, Button, buttonClass, Card, Notice, Select } from "@/components/ui";
import { draftQuestions, type DraftQuestion } from "@/lib/question-gen";
import { cn } from "@/lib/utils";

/** Lets the student pick a PDF, review drafted questions and add the ones they keep. */
export function QuestionGenerator({
  setId,
  mode,
  documents,
  defaultDocumentId,
  existingPrompts,
}: {
  setId: string;
  mode: "multiple_choice" | "identification";
  documents: { id: string; title: string }[];
  defaultDocumentId: string | null;
  existingPrompts: string[];
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState(
    documents.some((d) => d.id === defaultDocumentId) ? defaultDocumentId! : (documents[0]?.id ?? ""),
  );
  const [drafts, setDrafts] = useState<DraftQuestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"finding" | "adding" | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ tone: "danger" | "success" | "amber"; text: string } | null>(null);

  if (documents.length === 0) {
    return (
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-fg-muted">Upload a PDF to draft questions from it automatically.</p>
        <Link href="/library/upload" className={buttonClass("secondary", "sm")}>
          Upload PDF
        </Link>
      </Card>
    );
  }

  const find = async () => {
    setBusy("finding");
    setNotice(null);
    setDrafts(null);
    const pages = await getDocumentText(documentId).catch(() => null);
    setBusy(null);
    if (!pages) return setNotice({ tone: "danger", text: "Could not read that PDF's text. Try again." });
    const known = new Set(existingPrompts.map((p) => p.trim().toLowerCase()));
    const found = draftQuestions(pages, mode).filter((d) => !known.has(d.prompt.trim().toLowerCase()));
    if (found.length === 0) {
      return setNotice({
        tone: "amber",
        text:
          mode === "multiple_choice" && draftQuestions(pages, "identification").length > 0
            ? "Only one definition was found, so there are no other terms to use as wrong choices. Try an identification set, or a longer PDF."
            : "No new definitions found. This works best on notes with sentences like \"A stack is a…\", \"Recursion refers to…\" or \"Term: meaning\". Scanned PDFs have no text to read.",
      });
    }
    setDrafts(found);
    setSelected(new Set(found.map((d) => d.key)));
  };

  const add = async () => {
    if (!drafts) return;
    const chosen = drafts.filter((d) => selected.has(d.key));
    setBusy("adding");
    setNotice(null);
    let added = 0;
    for (const draft of chosen) {
      setProgress(added + 1);
      const result = await saveQuestion({
        setId,
        prompt: draft.prompt,
        options: draft.options,
        accepted: draft.accepted,
        sourceDocumentId: documentId,
        sourcePage: draft.page,
      }).catch(() => ({ ok: false as const, error: "Could not reach the server." }));
      if (!result.ok) {
        setNotice({ tone: "danger", text: `Added ${added} of ${chosen.length}. Stopped: ${result.error}` });
        break;
      }
      added++;
    }
    setBusy(null);
    if (added === chosen.length) {
      setNotice({ tone: "success", text: `Added ${added} ${added === 1 ? "question" : "questions"}. Edit any of them below.` });
      setDrafts(null);
    }
    router.refresh();
  };

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card className="mb-6 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Wand2 className="size-4 text-brand-text" /> Generate from a PDF
      </h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        Finds definitions in your PDF and drafts {mode === "multiple_choice" ? "multiple-choice" : "identification"} questions. Review them
        before adding — untick any that don&apos;t make sense.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="max-w-sm" aria-label="PDF">
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={find} disabled={busy !== null || !documentId}>
          {busy === "finding" ? <Loader2 className="animate-spin" /> : <Wand2 />} Find questions
        </Button>
      </div>

      {notice ? <Notice tone={notice.tone} className="mt-4">{notice.text}</Notice> : null}

      {drafts ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-fg-muted">
              {selected.size} of {drafts.length} selected
            </span>
            <span className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(drafts.map((d) => d.key)))}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Select none
              </Button>
            </span>
          </div>
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {drafts.map((draft) => {
              const on = selected.has(draft.key);
              return (
                <li key={draft.key}>
                  <label className={cn("flex cursor-pointer gap-3 px-3 py-3 text-sm", !on && "opacity-50")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(draft.key)} className="mt-1 accent-(--brand)" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{draft.prompt}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {draft.options ? (
                          draft.options.map((o) => (
                            <Badge key={o.body} tone={o.is_correct ? "success" : "neutral"}>
                              {o.is_correct ? <Check /> : null}
                              {o.body}
                            </Badge>
                          ))
                        ) : (
                          <Badge tone="success">
                            <Check /> {draft.accepted?.[0]}
                          </Badge>
                        )}
                        <span className="text-xs text-fg-subtle">page {draft.page}</span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={add} disabled={busy !== null || selected.size === 0}>
              {busy === "adding" ? <Loader2 className="animate-spin" /> : null}
              {busy === "adding" ? `Adding ${progress} of ${selected.size}…` : `Add ${selected.size} ${selected.size === 1 ? "question" : "questions"}`}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
