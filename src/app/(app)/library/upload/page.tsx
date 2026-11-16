import Link from "next/link";
import { PdfUploader } from "@/components/pdf-uploader";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Upload PDF" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const { supabase, user } = await requireProfile();
  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<Link href="/library" className="hover:text-fg">PDF Library</Link>}
        title="Upload PDFs"
        description="Files are stored privately in your account. Text is extracted on your device with PDF.js before upload."
      />
      <PdfUploader userId={user.id} subjects={subjects ?? []} defaultSubjectId={subject} />
    </div>
  );
}
