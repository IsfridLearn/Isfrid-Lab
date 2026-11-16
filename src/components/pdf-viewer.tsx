"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Loader2, Minus, PenLine, Plus, TextQuote } from "lucide-react";
import { QuestionForm, type QuestionFormHandle } from "@/components/question-editor";
import { Button, buttonClass, Card, Notice, Select } from "@/components/ui";
import { DOCUMENTS_BUCKET } from "@/lib/env";
import { modeLabel } from "@/lib/languages";
import { openPdf } from "@/lib/pdf";
import { createClient } from "@/lib/supabase/client";

interface TargetSet {
  id: string;
  title: string;
  mode: "multiple_choice" | "identification";
}

export function PdfViewer({
  doc,
  pages,
  sets,
  defaultSetId,
}: {
  doc: { id: string; storage_path: string; page_count: number };
  pages: string[];
  sets: TargetSet[];
  defaultSetId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<QuestionFormHandle>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState("");
  const [setId, setSetId] = useState(sets.some((s) => s.id === defaultSetId) ? defaultSetId! : (sets[0]?.id ?? ""));
  const [savedCount, setSavedCount] = useState(0);
  const total = pdf?.numPages ?? doc.page_count;
  const target = sets.find((s) => s.id === setId);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      const { data, error } = await createClient().storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
      if (cancelled) return;
      if (error || !data) return setLoadError("The PDF file could not be downloaded from storage.");
      try {
        loaded = await openPdf(await data.arrayBuffer());
        if (cancelled) return void loaded.loadingTask.destroy();
        setPdf(loaded);
      } catch {
        if (!cancelled) setLoadError("The PDF file could not be opened.");
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.loadingTask.destroy();
    };
  }, [doc.storage_path]);

  useEffect(() => {
    if (!pdf) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const pdfPage = await pdf.getPage(page);
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (cancelled || !canvas || !frame) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const cssScale = ((frame.clientWidth - 2) / base.width) * zoom;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: cssScale * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = pdfPage.render({ canvas, viewport });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom]);

  const go = (next: number) => {
    setPage(Math.max(1, Math.min(total, next)));
    setSelection("");
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    const text = sel && textRef.current?.contains(sel.anchorNode) ? sel.toString().replace(/\s+/g, " ").trim() : "";
    setSelection(text);
  };

  const pageText = pages[page - 1] ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <label className="flex items-center gap-1.5 text-[13px] text-fg-muted">
              <span className="sr-only">Page</span>
              <input
                type="number"
                min={1}
                max={total}
                value={page}
                onChange={(e) => go(Number(e.target.value) || 1)}
                className="h-8 w-14 rounded-md border border-border-strong bg-surface text-center text-[13px] text-fg tabular-nums"
              />
              of {total}
            </label>
            <Button variant="secondary" size="sm" onClick={() => go(page + 1)} disabled={page >= total} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">
              <Minus />
            </Button>
            <span className="w-11 text-center text-xs tabular-nums text-fg-muted">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">
              <Plus />
            </Button>
          </div>
        </div>
        <div ref={frameRef} className="max-h-[78vh] overflow-auto rounded-card border border-border bg-muted">
          {loadError ? (
            <p className="p-6 text-sm text-danger">{loadError}</p>
          ) : !pdf ? (
            <div className="flex h-96 items-center justify-center text-fg-subtle">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : null}
          <canvas ref={canvasRef} className={pdf ? "mx-auto block bg-white" : "hidden"} />
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TextQuote className="size-4 text-brand-text" /> Extracted text · page {page}
            </h2>
            <span className="text-xs text-fg-subtle">{pageText.length.toLocaleString()} characters</span>
          </div>
          {pageText ? (
            <div
              ref={textRef}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              onTouchEnd={captureSelection}
              className="max-h-80 overflow-auto rounded-lg bg-muted/60 p-3 text-sm leading-relaxed whitespace-pre-wrap text-fg selection:bg-amber-300/50"
            >
              {pageText}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              No text could be extracted from this page. It is probably a scanned image; ISFRID does not run OCR.
            </p>
          )}
          <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2">
            {selection ? (
              <>
                <span className="text-xs text-fg-subtle">Selected {selection.length} characters:</span>
                <Button size="sm" variant="secondary" disabled={!target} onClick={() => formRef.current?.insert("prompt", selection)}>
                  Use as question
                </Button>
                <Button size="sm" variant="secondary" disabled={!target} onClick={() => formRef.current?.insert("answer", selection)}>
                  Use as answer
                </Button>
              </>
            ) : (
              <span className="text-xs text-fg-subtle">Highlight text above to use it in a question.</span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <PenLine className="size-4 text-brand-text" /> Write a question from this page
          </h2>
          {sets.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">Create a multiple-choice or identification study set first, then write questions here while you read.</p>
              <Link href={`/sets/new?document=${doc.id}`} className={buttonClass("primary")}>
                Create a study set
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1.5 block text-[13px] font-medium">Add to study set</span>
                  <Select value={setId} onChange={(e) => setSetId(e.target.value)}>
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({modeLabel(s.mode)})
                      </option>
                    ))}
                  </Select>
                </label>
                {target ? (
                  <Link href={`/sets/${target.id}/edit`} className={buttonClass("ghost")}>
                    Open set
                  </Link>
                ) : null}
              </div>
              {savedCount > 0 ? <Notice tone="success">{savedCount} {savedCount === 1 ? "question" : "questions"} added from this document.</Notice> : null}
              {target ? (
                <QuestionForm
                  key={target.id}
                  ref={formRef}
                  setId={target.id}
                  mode={target.mode}
                  source={{ documentId: doc.id, page }}
                  onSaved={() => setSavedCount((n) => n + 1)}
                />
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
