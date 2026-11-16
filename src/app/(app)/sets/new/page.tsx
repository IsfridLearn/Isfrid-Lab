import Link from "next/link";
import { NewSetForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "New study set" };

export default async function NewSetPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; subject?: string; document?: string }>;
}) {
  const query = await searchParams;
  const { supabase, isTechnical } = await requireProfile();
  const [subjectsRes, docsRes] = await Promise.all([
    supabase.from("subjects").select("id, name").order("name"),
    supabase.from("documents").select("id, title").order("created_at", { ascending: false }).limit(200),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<Link href="/sets" className="hover:text-fg">My Study Sets</Link>}
        title="Choose a study mode"
        description="Each study set uses one mode. You write every question and answer yourself."
      />
      <NewSetForm
        subjects={subjectsRes.data ?? []}
        documents={docsRes.data ?? []}
        isTechnical={isTechnical}
        defaults={{ mode: query.mode, subjectId: query.subject, documentId: query.document }}
      />
    </div>
  );
}
