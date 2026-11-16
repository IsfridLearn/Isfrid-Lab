import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { RowList, SetRow } from "@/components/rows";
import { buttonClass, EmptyState, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MODES } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { StudySet, Subject } from "@/lib/types";

export const metadata = { title: "My Study Sets" };

export default async function SetsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const { supabase, isTechnical } = await requireProfile();
  const activeMode = MODES.find((m) => m.id === mode)?.id;

  let query = supabase.from("study_sets").select("*, questions(count), coding_exercises(count)").order("updated_at", { ascending: false });
  if (activeMode) query = query.eq("mode", activeMode);
  const [setsRes, subjectsRes] = await Promise.all([query, supabase.from("subjects").select("id, name")]);

  type SetWithCounts = StudySet & { questions: { count: number }[]; coding_exercises: { count: number }[] };
  const sets = (setsRes.data ?? []) as SetWithCounts[];
  const subjects = (subjectsRes.data ?? []) as Pick<Subject, "id" | "name">[];
  const tabs = [{ id: undefined, label: "All" }, ...MODES.filter((m) => m.id !== "coding" || isTechnical)];

  return (
    <>
      <PageHeader
        title="My Study Sets"
        description="Every set you've written. Open one to study, edit or take an assessment."
        actions={
          <Link href="/sets/new" className={buttonClass("primary")}>
            <Plus /> New study set
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.id ? `/sets?mode=${tab.id}` : "/sets"}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              activeMode === tab.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {sets.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title={activeMode ? "No study sets in this mode" : "No study sets yet"}
          description="A study set is a group of questions you write yourself, usually from one PDF or chapter."
          action={
            <Link href={activeMode ? `/sets/new?mode=${activeMode}` : "/sets/new"} className={buttonClass("primary")}>
              <Plus /> Create a study set
            </Link>
          }
        />
      ) : (
        <RowList>
          {sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              subjectName={subjects.find((s) => s.id === set.subject_id)?.name}
              count={(set.mode === "coding" ? set.coding_exercises[0]?.count : set.questions[0]?.count) ?? 0}
            />
          ))}
        </RowList>
      )}
    </>
  );
}
