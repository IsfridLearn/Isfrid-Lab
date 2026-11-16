import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExerciseEditor } from "@/components/exercise-editor";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";
import type { CodingExercise, StudySet } from "@/lib/types";

export const metadata = { title: "Coding exercise editor" };

/** /sets/:id/exercises/new creates; /sets/:id/exercises/:exerciseId edits. */
export default async function ExercisePage({ params }: { params: Promise<{ id: string; exerciseId: string }> }) {
  const { id, exerciseId } = await params;
  const { supabase, isTechnical } = await requireProfile();
  if (!isTechnical) redirect("/codelab");

  const { data: setRow } = await supabase.from("study_sets").select("*").eq("id", id).maybeSingle();
  const set = setRow as StudySet | null;
  if (!set || set.mode !== "coding") notFound();

  let exercise: CodingExercise | undefined;
  if (exerciseId !== "new") {
    const { data } = await supabase.from("coding_exercises").select("*, coding_test_cases(*)").eq("id", exerciseId).eq("set_id", set.id).maybeSingle();
    if (!data) notFound();
    exercise = data as CodingExercise;
  }

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/sets/${set.id}/edit`} className="hover:text-fg">{set.title}</Link>}
        title={exercise ? "Edit coding exercise" : "New coding exercise"}
      />
      <ExerciseEditor setId={set.id} exercise={exercise} remoteExecutionEnabled={isRemoteExecutionConfigured} />
    </>
  );
}
