import Link from "next/link";
import { FileText, FileUp, Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/library";
import { ConfirmSubmit } from "@/components/client-ui";
import { DocumentEditButton } from "@/components/forms";
import { buttonClass, EmptyState, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MAX_PDF_BYTES } from "@/lib/env";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { DocumentRow, Subject } from "@/lib/types";

export const metadata = { title: "PDF Library" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const [docsRes, subjectsRes] = await Promise.all([
    supabase.from("documents").select("id, subject_id, title, file_name, storage_path, size_bytes, page_count, char_count, created_at").order("created_at", { ascending: false }),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const all = (docsRes.data ?? []) as DocumentRow[];
  const subjects = (subjectsRes.data ?? []) as Pick<Subject, "id" | "name">[];
  const docs = subject === "none" ? all.filter((d) => !d.subject_id) : subject ? all.filter((d) => d.subject_id === subject) : all;
  const used = all.reduce((sum, d) => sum + Number(d.size_bytes), 0);
  const filters = [{ id: undefined as string | undefined, name: "All" }, ...subjects, ...(all.some((d) => !d.subject_id) ? [{ id: "none", name: "Unassigned" }] : [])];

  return (
    <>
      <PageHeader
        title="PDF Library"
        description={`${all.length} ${all.length === 1 ? "document" : "documents"} · ${formatBytes(used)} stored · up to ${formatBytes(MAX_PDF_BYTES)} per file`}
        actions={
          <Link href="/library/upload" className={buttonClass("primary")}>
            <FileUp /> Upload PDF
          </Link>
        }
      />
      {all.length > 0 && subjects.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-1">
          {filters.map((f) => (
            <Link
              key={f.id ?? "all"}
              href={f.id ? `/library?subject=${f.id}` : "/library"}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", subject === f.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg")}
            >
              {f.name}
            </Link>
          ))}
        </div>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={all.length ? "No documents in this subject" : "Your library is empty"}
          description="Upload lecture notes, modules or reviewers as PDF. ISFRID extracts the text so you can build questions from it."
          action={
            <Link href="/library/upload" className={buttonClass("primary")}>
              <FileUp /> Upload your first PDF
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/library/${doc.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-fg-muted">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium hover:underline">{doc.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">
                    {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} · {formatBytes(doc.size_bytes)}
                    {doc.char_count === 0 ? " · no extractable text" : ""}
                    {doc.subject_id ? ` · ${subjects.find((s) => s.id === doc.subject_id)?.name ?? ""}` : ""} · {formatDate(doc.created_at, profile.timezone)}
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <DocumentEditButton doc={{ id: doc.id, title: doc.title, subject_id: doc.subject_id }} subjects={subjects} />
                <form action={deleteDocument.bind(null, doc.id)}>
                  <ConfirmSubmit message={`Delete "${doc.title}"? The file is removed from storage. Questions you wrote from it are kept.`}>
                    <Trash2 /> Delete
                  </ConfirmSubmit>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
