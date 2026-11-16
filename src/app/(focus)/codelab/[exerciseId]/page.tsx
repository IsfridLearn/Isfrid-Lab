import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Workspace } from "@/components/workspace";
import { requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";
import { toWorkspaceExercise, type WorkspaceSubmission } from "@/lib/workspace";
import type { CodingExercise } from "@/lib/types";

export const metadata = { title: "Coding workspace" };

export default async function PracticePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const { supabase, profile, isTechnical } = await requireProfile();
  if (!isTechnical) redirect("/codelab");

  const { data } = await supabase.from("coding_exercises").select("*, coding_test_cases(*)").eq("id", exerciseId).maybeSingle();
  const exercise = data as CodingExercise | null;
  if (!exercise) notFound();

  const [siblingsRes, submissionsRes] = await Promise.all([
    supabase.from("coding_exercises").select("id").eq("set_id", exercise.set_id).order("position"),
    supabase
      .from("coding_submissions")
      .select("id, status, passed_count, total_count, code, created_at")
      .eq("exercise_id", exercise.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const ids = (siblingsRes.data ?? []).map((row) => row.id as string);
  const index = ids.indexOf(exercise.id);
  const navClass = "rounded-md p-1.5 text-fg-muted hover:bg-muted hover:text-fg";

  return (
    <div className="flex flex-1 flex-col lg:h-screen">
      <Workspace
        key={exercise.id}
        exercise={toWorkspaceExercise(exercise)}
        submissions={(submissionsRes.data ?? []) as WorkspaceSubmission[]}
        remoteExecutionEnabled={isRemoteExecutionConfigured}
        timeZone={profile.timezone}
        header={
          <>
            <Link href={`/sets/${exercise.set_id}`} className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
              <ArrowLeft className="size-4" /> Back to set
            </Link>
            <span className="hidden truncate text-sm font-medium sm:block">{exercise.title}</span>
            <span className="flex items-center text-xs text-fg-subtle">
              {index > 0 ? (
                <Link href={`/codelab/${ids[index - 1]}`} className={navClass} aria-label="Previous exercise">
                  <ChevronLeft className="size-4" />
                </Link>
              ) : null}
              {index + 1} / {ids.length}
              {index < ids.length - 1 ? (
                <Link href={`/codelab/${ids[index + 1]}`} className={navClass} aria-label="Next exercise">
                  <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </span>
          </>
        }
      />
    </div>
  );
}
