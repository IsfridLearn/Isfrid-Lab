import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Plus } from "lucide-react";
import { CodeExerciseGenerator } from "@/components/code-exercise-generator";
import { DeleteExerciseButton } from "@/components/exercise-editor";
import { SetSettingsForm } from "@/components/forms";
import { QuestionList } from "@/components/question-editor";
import { QuestionGenerator } from "@/components/question-generator";
import { Badge, buttonClass, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { exerciseTypeLabel, languageInfo, modeLabel } from "@/lib/languages";
import type { CodingExercise, Question, StudySet } from "@/lib/types";

export const metadata = { title: "Edit study set" };

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("study_sets").select("*").eq("id", id).maybeSingle();
  const set = data as StudySet | null;
  if (!set) notFound();

  const [itemsRes, subjectsRes, docsRes] = await Promise.all([
    set.mode === "coding"
      ? supabase.from("coding_exercises").select("*").eq("set_id", set.id).order("position")
      : supabase.from("questions").select("*, answer_options(*), accepted_answers(*)").eq("set_id", set.id).order("position"),
    supabase.from("subjects").select("id, name").order("name"),
    supabase.from("documents").select("id, title").gt("char_count", 0).order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/sets/${set.id}`} className="hover:text-fg">{set.title}</Link>}
        title={`${modeLabel(set.mode)} editor`}
        description={
          set.mode === "coding"
            ? "Build coding exercises yourself, or draft fill-in-the-blank ones from code in a PDF and review each one before adding it."
            : "Write questions yourself, or draft them from a PDF's definitions and review each one before adding it."
        }
        actions={
          <Link href={`/sets/${set.id}`} className={buttonClass("primary")}>
            Done
          </Link>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          {set.mode === "coding" ? (
            <>
              <SectionTitle
                action={
                  <Link href={`/sets/${set.id}/exercises/new`} className={buttonClass("primary", "sm")}>
                    <Plus /> New exercise
                  </Link>
                }
              >
                Exercises
              </SectionTitle>
              <CodeExerciseGenerator
                setId={set.id}
                documents={docsRes.data ?? []}
                defaultDocumentId={set.document_id}
                existingSolutions={((itemsRes.data ?? []) as CodingExercise[]).map((e) => e.solution_code)}
              />
              {(itemsRes.data ?? []).length === 0 ? (
                <EmptyState title="No exercises yet" description="Create your first coding exercise for this set." />
              ) : (
                <div className="space-y-3">
                  {((itemsRes.data ?? []) as CodingExercise[]).map((exercise, index) => (
                    <div key={exercise.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
                      <span className="font-mono text-xs text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{exercise.title}</p>
                        <p className="text-xs text-fg-subtle">{exerciseTypeLabel(exercise.exercise_type)}</p>
                      </div>
                      <Badge>{languageInfo(exercise.language).label}</Badge>
                      <Link href={`/sets/${set.id}/exercises/${exercise.id}`} className={buttonClass("secondary", "sm")}>
                        <Pencil /> Edit
                      </Link>
                      <DeleteExerciseButton id={exercise.id} setId={set.id} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <QuestionGenerator
                setId={set.id}
                mode={set.mode}
                documents={docsRes.data ?? []}
                defaultDocumentId={set.document_id}
                existingPrompts={((itemsRes.data ?? []) as Question[]).map((q) => q.prompt)}
              />
              <QuestionList setId={set.id} mode={set.mode} questions={(itemsRes.data ?? []) as Question[]} />
            </>
          )}
        </section>
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Set settings</h2>
            <SetSettingsForm set={set} subjects={subjectsRes.data ?? []} />
          </Card>
          {set.document_id && set.mode !== "coding" ? (
            <Link href={`/library/${set.document_id}?set=${set.id}`} className="flex items-center gap-2.5 rounded-card border border-border bg-surface p-4 text-sm hover:border-border-strong">
              <FileText className="size-4 text-brand-text" />
              <span>Write questions from the source PDF</span>
            </Link>
          ) : null}
        </aside>
      </div>
    </>
  );
}
