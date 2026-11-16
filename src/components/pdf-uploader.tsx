"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { Field, ProgressBar, Select } from "@/components/ui";
import { DOCUMENTS_BUCKET, MAX_PDF_BYTES, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { extractAllText, openPdf } from "@/lib/pdf";
import { createClient } from "@/lib/supabase/client";
import { cn, formatBytes } from "@/lib/utils";

interface Item {
  key: string;
  name: string;
  size: number;
  status: "queued" | "extracting" | "uploading" | "saving" | "done" | "error";
  progress: number;
  error?: string;
  note?: string;
  docId?: string;
}

const STATUS_TEXT: Record<Item["status"], string> = {
  queued: "Waiting",
  extracting: "Extracting text",
  uploading: "Uploading",
  saving: "Saving",
  done: "Ready",
  error: "Failed",
};

/** Upload straight to Supabase Storage with XHR so we get real progress events. */
function uploadWithProgress(path: string, file: File, token: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${DOCUMENTS_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (HTTP ${xhr.status}).`;
      try {
        message = JSON.parse(xhr.responseText).message ?? message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export function PdfUploader({
  userId,
  subjects,
  defaultSubjectId,
}: {
  userId: string;
  subjects: { id: string; name: string }[];
  defaultSubjectId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects.some((s) => s.id === defaultSubjectId) ? defaultSubjectId! : "");
  const busy = useRef(false);
  const queue = useRef<{ key: string; file: File }[]>([]);
  const subjectRef = useRef(subjectId);

  const patch = (key: string, changes: Partial<Item>) => setItems((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const processOne = useCallback(
    async (key: string, file: File) => {
      const supabase = createClient();
      let storagePath: string | null = null;
      try {
        patch(key, { status: "extracting", progress: 2 });
        const buffer = await file.arrayBuffer();
        const pdf = await openPdf(buffer.slice(0)).catch(() => {
          throw new Error("This file could not be read as a PDF. It may be damaged or password-protected.");
        });
        const pages = await extractAllText(pdf, (done, total) => patch(key, { progress: 2 + (done / total) * 28 }));
        const pageCount = pdf.numPages;
        await pdf.loadingTask.destroy();
        const charCount = pages.reduce((sum, page) => sum + page.length, 0);

        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Your session expired. Log in again.");

        patch(key, { status: "uploading", progress: 30 });
        storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
        await uploadWithProgress(storagePath, file, token, (fraction) => patch(key, { progress: 30 + fraction * 62 }));

        patch(key, { status: "saving", progress: 95 });
        const { data, error } = await supabase
          .from("documents")
          .insert({
            title: file.name.replace(/\.pdf$/i, "").slice(0, 200) || "Untitled document",
            file_name: file.name.slice(0, 255),
            storage_path: storagePath,
            size_bytes: file.size,
            page_count: pageCount,
            char_count: charCount,
            extracted_pages: pages,
            subject_id: subjectRef.current || null,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error("The file uploaded but its record could not be saved.");

        patch(key, {
          status: "done",
          progress: 100,
          docId: data.id as string,
          note: charCount === 0 ? "No selectable text found — this looks like a scanned PDF. You can still view it, but there is no text to quote." : undefined,
        });
      } catch (error) {
        if (storagePath) await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
        patch(key, { status: "error", error: error instanceof Error ? error.message : "Something went wrong." });
      }
    },
    [userId],
  );

  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      await processOne(next.key, next.file);
    }
    busy.current = false;
    router.refresh();
  }, [processOne, router]);

  const addFiles = (files: FileList | File[]) => {
    const added: Item[] = [];
    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const problem = !isPdf ? "Only PDF files can be uploaded." : file.size > MAX_PDF_BYTES ? `Larger than the ${formatBytes(MAX_PDF_BYTES)} limit.` : file.size === 0 ? "The file is empty." : null;
      added.push({ key, name: file.name, size: file.size, status: problem ? "error" : "queued", progress: 0, error: problem ?? undefined });
      if (!problem) queue.current.push({ key, file });
    }
    setItems((list) => [...list, ...added]);
    void drain();
  };

  return (
    <div className="space-y-6">
      <Field label="Add to subject" hint="Optional. You can change this later." className="max-w-sm">
        <Select
          value={subjectId}
          onChange={(e) => {
            subjectRef.current = e.target.value;
            setSubjectId(e.target.value);
          }}
        >
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:bg-muted/60",
        )}
      >
        <UploadCloud className="size-7 text-brand-text" />
        <p className="mt-3 text-sm font-medium">Drag PDFs here, or click to choose files</p>
        <p className="mt-1 text-xs text-fg-subtle">PDF only · up to {formatBytes(MAX_PDF_BYTES)} each · text is extracted in your browser</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {items.map((item) => (
            <li key={item.key} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {item.status === "done" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : item.status === "error" ? (
                  <AlertCircle className="size-4 shrink-0 text-danger" />
                ) : item.status === "queued" ? (
                  <FileText className="size-4 shrink-0 text-fg-subtle" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin text-brand-text" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                <span className="text-xs text-fg-subtle">{formatBytes(item.size)}</span>
                {item.docId ? (
                  <Link href={`/library/${item.docId}`} className="text-[13px] font-medium text-brand-text hover:underline">
                    Open
                  </Link>
                ) : (
                  <span className="w-28 text-right text-xs text-fg-muted">
                    {STATUS_TEXT[item.status]}
                    {item.status !== "queued" && item.status !== "error" ? ` ${Math.round(item.progress)}%` : ""}
                  </span>
                )}
              </div>
              {item.status !== "done" && item.status !== "error" && item.status !== "queued" ? <ProgressBar value={item.progress} className="mt-2" /> : null}
              {item.error ? <p className="mt-1.5 ml-7 text-xs text-danger">{item.error}</p> : null}
              {item.note ? <p className="mt-1.5 ml-7 text-xs text-amber">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
