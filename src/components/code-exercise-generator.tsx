"use client";

// "Generate from PDF" panel for coding sets: drafts fill-in-the-blank exercises from code found in a PDF.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Wand2 } from "lucide-react";
import { saveExercise } from "@/app/actions/content";
import { getDocumentText } from "@/app/actions/library";
import { Badge, Button, buttonClass, Card, Notice, Select } from "@/components/ui";
import { BLANK_KINDS, draftCodeExercises, findCodeSnippets, type BlankKind, type CodeDraft } from "@/lib/code-gen";
import { LANGUAGES, languageInfo } from "@/lib/languages";
import type { LanguageId } from "@/lib/types";
import { cn } from "@/lib/utils";

const squash = (code: string) => code.replace(/\s+/g, "");

/** Lets the student pick a PDF, review drafted coding exercises and add the ones they keep. */
export function CodeExerciseGenerator({
  setId,
  documents,
  defaultDocumentId,
  existingSolutions,
}: {
  setId: string;
  documents: { id: string; title: string }[];
  defaultDocumentId: string | null;
  existingSolutions: string[];
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState(
    documents.some((d) => d.id === defaultDocumentId) ? defaultDocumentId! : (documents[0]?.id ?? ""),
  );
  const [kind, setKind] = useState<BlankKind>("keywords");
  const [language, setLanguage] = useState<LanguageId | "auto">("auto");
  const [drafts, setDrafts] = useState<CodeDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"finding" | "adding" | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ tone: "danger" | "success" | "amber"; text: string } | null>(null);

  if (documents.length === 0) {
    return (
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-fg-muted">Upload a PDF with code in it to draft exercises from it automatically.</p>
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
    const known = new Set(existingSolutions.map(squash));
    const found = draftCodeExercises(pages, kind, language).filter((d) => !known.has(squash(d.solution)));
    if (found.length === 0) {
      const snippets = findCodeSnippets(pages);
      return setNotice({
        tone: "amber",
        text:
          snippets.length === 0
            ? "No code found in this PDF. It needs code printed as text (3 or more lines in a row). Screenshots of code and scanned pages have no text to read."
            : language === "auto" && snippets.every((s) => !s.language)
              ? "Code was found but its language couldn't be recognised. Pick the language above and try again."
              : "No new exercises to draft. Everything found is already in this set, or nothing of that kind could be blanked out — try another option under “Blank out”.",
      });
    }
    setDrafts(found);
    setSelected(new Set(found.map((d) => d.key)));
  };

  const add = async () => {
    if (!drafts) return;
    const chosen = drafts.filter((d) => selected.has(d.key));
    const documentTitle = documents.find((d) => d.id === documentId)?.title ?? "your PDF";
    const noun = BLANK_KINDS.find((k) => k.id === kind)!.noun;
    setBusy("adding");
    setNotice(null);
    let added = 0;
    for (const draft of chosen) {
      setProgress(added + 1);
      const result = await saveExercise({
        setId,
        title: draft.title,
        exerciseType: draft.exerciseType,
        language: draft.language,
        description: `Fill in the missing ${noun} in this ${languageInfo(draft.language).label} code from page ${draft.page} of “${documentTitle}”.`,
        instructions: "Replace each blank (__1__, __2__ …) with the missing code.",
        hints: draft.blanks.map((b) => `Blank ${b.n} starts with “${b.answers[0][0]}”.`),
        templateCode: draft.template,
        solutionCode: draft.solution,
        setupCode: "",
        validation: "blanks",
        blanks: draft.blanks,
        expectedOutput: "",
        points: 10,
        testCases: [],
      }).catch(() => ({ ok: false as const, error: "Could not reach the server." }));
      if (!result.ok) {
        setNotice({ tone: "danger", text: `Added ${added} of ${chosen.length}. Stopped: ${result.error}` });
        break;
      }
      added++;
    }
    setBusy(null);
    if (added === chosen.length) {
      setNotice({ tone: "success", text: `Added ${added} ${added === 1 ? "exercise" : "exercises"}. Open any of them below to edit.` });
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
        Finds code in your PDF and blanks out parts of it. Review the drafts before adding — untick any that don&apos;t make sense.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Select value={documentId} onChange={(e) => setDocumentId(e.target.value)} aria-label="PDF" className="sm:col-span-3">
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as BlankKind)} aria-label="Blank out">
          {BLANK_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              Blank out: {k.label}
            </option>
          ))}
        </Select>
        <Select value={language} onChange={(e) => setLanguage(e.target.value as LanguageId | "auto")} aria-label="Language">
          <option value="auto">Detect language</option>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={find} disabled={busy !== null || !documentId}>
          {busy === "finding" ? <Loader2 className="animate-spin" /> : <Wand2 />} Find exercises
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
          <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {drafts.map((draft) => {
              const on = selected.has(draft.key);
              return (
                <li key={draft.key}>
                  <label className={cn("flex cursor-pointer gap-3 px-3 py-3 text-sm", !on && "opacity-50")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(draft.key)} className="mt-1 accent-(--brand)" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{draft.title}</span>
                        <span className="text-xs text-fg-subtle">page {draft.page}</span>
                      </span>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{draft.template}</pre>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        {draft.blanks.map((b) => (
                          <Badge key={b.n} tone="success">
                            <Check /> {b.n}: {b.answers[0]}
                          </Badge>
                        ))}
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
              {busy === "adding" ? `Adding ${progress} of ${selected.size}…` : `Add ${selected.size} ${selected.size === 1 ? "exercise" : "exercises"}`}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
