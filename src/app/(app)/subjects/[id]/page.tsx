import Link from "next/link";
import { notFound } from "next/navigation";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { deleteSubject } from "@/app/actions/library";
import { ScoreTrend } from "@/components/charts";
import { ConfirmSubmit } from "@/components/client-ui";
import { SubjectFormButton } from "@/components/forms";
import { AttemptRow, DocumentRowLink, RowList, SetRow } from "@/components/rows";
import { buttonClass, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MODES, subjectColorClass } from "@/lib/languages";
import { cn, formatPercent } from "@/lib/utils";
import type { Attempt, DocumentRow, StudySet, Subject } from "@/lib/types";

export const metadata = { title: "Subject" };

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile, isTechnical } = await requireProfile();
  const [subjectRes, setsRes, docsRes, attemptsRes] = await Promise.all([
    supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
    supabase.from("study_sets").select("*, questions(count), coding_exercises(count)").eq("subject_id", id).order("updated_at", { ascending: false }),
    supabase.from("documents").select("id, subject_id, title, file_name, storage_path, size_bytes, page_count, char_count, created_at").eq("subject_id", id).order("created_at", { ascending: false }),
    supabase.from("assessment_attempts").select("*").eq("subject_id", id).eq("status", "completed").order("completed_at", { ascending: false }).limit(100),
  ]);
  const subject = subjectRes.data as Subject | null;
  if (!subject) notFound();

  type SetWithCounts = StudySet & { questions: { count: number }[]; coding_exercises: { count: number }[] };
  const sets = (setsRes.data ?? []) as SetWithCounts[];
  const docs = (docsRes.data ?? []) as DocumentRow[];
  const attempts = (attemptsRes.data ?? []) as Attempt[];
  const scores = attempts.map((a) => Number(a.score_percent));
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const codingSolved = attempts.filter((a) => a.mode === "coding").reduce((sum, a) => sum + a.correct_count, 0);
  const itemCount = (set: SetWithCounts) => (set.mode === "coding" ? set.coding_exercises[0]?.count : set.questions[0]?.count) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/subjects" className="hover:text-fg">My Subjects</Link>}
        title={
          <span className="flex items-center gap-3">
            <span className={cn("size-3 rounded-full", subjectColorClass[subject.color] ?? "bg-slate-500")} />
            {subject.name}
            {subject.code ? <span className="text-base font-normal text-fg-subtle">{subject.code}</span> : null}
          </span>
        }
        description={subject.description}
        actions={
          <>
            <SubjectFormButton subject={subject} />
            <form action={deleteSubject.bind(null, subject.id)}>
              <ConfirmSubmit size="md" message={`Delete "${subject.name}"? Its PDFs and study sets are kept but become unassigned.`}>
                <Trash2 /> Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="grid grid-cols-2 gap-6 p-5 lg:col-span-1">
          <Stat label="Average score" value={average == null ? "—" : formatPercent(average)} />
          <Stat label="Best score" value={scores.length ? formatPercent(Math.max(...scores)) : "—"} />
          <Stat label="Assessments" value={attempts.length} />
          {isTechnical ? <Stat label="Coding solved" value={codingSolved} /> : <Stat label="Study sets" value={sets.length} />}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="mb-3 text-[13px] text-fg-muted">Score trend</p>
          <ScoreTrend scores={[...scores].reverse()} className="h-32" />
        </Card>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle
            action={
              <Link href={`/sets/new?subject=${subject.id}`} className={buttonClass("secondary", "sm")}>
                <Plus /> New set
              </Link>
            }
          >
            Study sets
          </SectionTitle>
          {sets.length === 0 ? (
            <EmptyState title="No study sets in this subject" description="Create multiple-choice, identification or coding sets for this course." />
          ) : (
            <div className="space-y-5">
              {MODES.filter((m) => sets.some((s) => s.mode === m.id)).map((mode) => (
                <div key={mode.id}>
                  <p className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">{mode.label}</p>
                  <RowList>
                    {sets
                      .filter((s) => s.mode === mode.id)
                      .map((set) => (
                        <SetRow key={set.id} set={set} count={itemCount(set)} />
                      ))}
                  </RowList>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-8">
          <section>
            <SectionTitle
              action={
                <Link href={`/library/upload?subject=${subject.id}`} className={buttonClass("secondary", "sm")}>
                  <FileUp /> Upload
                </Link>
              }
            >
              Uploaded PDFs
            </SectionTitle>
            {docs.length ? (
              <RowList>
                {docs.map((doc) => (
                  <DocumentRowLink key={doc.id} doc={doc} timeZone={profile.timezone} />
                ))}
              </RowList>
            ) : (
              <EmptyState title="No PDFs in this subject" />
            )}
          </section>

          <section>
            <SectionTitle>Assessment history</SectionTitle>
            {attempts.length ? (
              <RowList>
                {attempts.slice(0, 8).map((attempt) => (
                  <AttemptRow key={attempt.id} attempt={attempt} timeZone={profile.timezone} />
                ))}
              </RowList>
            ) : (
              <EmptyState title="No assessments taken yet" />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
