import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/library";
import { ConfirmSubmit } from "@/components/client-ui";
import { DocumentEditButton } from "@/components/forms";
import { PdfViewer } from "@/components/pdf-viewer";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { formatBytes } from "@/lib/utils";

export const metadata = { title: "PDF viewer" };

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ set?: string }>;
}) {
  const [{ id }, { set }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireProfile();
  const [docRes, setsRes, subjectsRes] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).maybeSingle(),
    supabase.from("study_sets").select("id, title, mode").in("mode", ["multiple_choice", "identification"]).order("updated_at", { ascending: false }),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const doc = docRes.data;
  if (!doc) notFound();
  const pages = Array.isArray(doc.extracted_pages) ? (doc.extracted_pages as string[]) : [];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/library" className="hover:text-fg">PDF Library</Link>}
        title={doc.title}
        description={`${doc.page_count} ${doc.page_count === 1 ? "page" : "pages"} · ${formatBytes(doc.size_bytes)} · ${doc.file_name}`}
        actions={
          <>
            <DocumentEditButton doc={{ id: doc.id, title: doc.title, subject_id: doc.subject_id }} subjects={subjectsRes.data ?? []} />
            <form action={deleteDocument.bind(null, doc.id)}>
              <ConfirmSubmit message={`Delete "${doc.title}"? The file is removed from storage.`}>
                <Trash2 /> Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />
      <PdfViewer
        doc={{ id: doc.id, storage_path: doc.storage_path, page_count: doc.page_count }}
        pages={pages}
        sets={(setsRes.data ?? []) as { id: string; title: string; mode: "multiple_choice" | "identification" }[]}
        defaultSetId={set}
      />
    </>
  );
}
