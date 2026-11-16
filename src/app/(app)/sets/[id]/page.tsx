import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Play, Trash2 } from "lucide-react";
import { deleteSet } from "@/app/actions/library";
import { ConfirmSubmit } from "@/components/client-ui";
import { StartAttemptForm } from "@/components/forms";
import { AttemptRow, RowList } from "@/components/rows";
import { Badge, buttonClass, Card, EmptyState, Notice, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { exerciseTypeLabel, languageInfo, modeLabel } from "@/lib/languages";
import { formatPercent } from "@/lib/utils";
import type { Attempt, CodingExercise, Question, StudySet } from "@/lib/types";

export const metadata = { title: "Study set" };

export default async function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data } = await supabase.from("study_sets").select("*").eq("id", id).maybeSingle();
  const set = data as StudySet | null;
  if (!set) notFound();

  const [itemsRes, attemptsRes, subjectRes, docRes] = await Promise.all([
    set.mode === "coding"
      ? supabase.from("coding_exercises").select("*").eq("set_id", set.id).order("position")
      : supabase.from("questions").select("*, answer_options(*), accepted_answers(*)").eq("set_id", set.id).order("position"),
    supabase.from("assessment_attempts").select("*").eq("set_id", set.id).order("started_at", { ascending: false }).limit(50),
    set.subject_id ? supabase.from("subjects").select("id, name").eq("id", set.subject_id).maybeSingle() : null,
    set.document_id ? supabase.from("documents").select("id, title").eq("id", set.document_id).maybeSingle() : null,
  ]);
  const questions = set.mode === "coding" ? [] : ((itemsRes.data ?? []) as Question[]);
  const exercises = set.mode === "coding" ? ((itemsRes.data ?? []) as CodingExercise[]) : [];
  const itemCount = questions.length + exercises.length;
  const attempts = (attemptsRes.data ?? []) as Attempt[];
  const completed = attempts.filter((a) => a.status === "completed");
  const open = attempts.find((a) => a.status === "in_progress");
  const scores = completed.map((a) => Number(a.score_percent));

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/sets" className="hover:text-fg">My Study Sets</Link>
            {subjectRes?.data ? (
              <>
                <span>·</span>
                <Link href={`/subjects/${subjectRes.data.id}`} className="hover:text-fg">{subjectRes.data.name}</Link>
              </>
            ) : null}
          </span>
        }
        title={set.title}
        description={set.description}
        actions={
          <>
            <Link href={`/sets/${set.id}/edit`} className={buttonClass("secondary")}>
              <Pencil /> Edit
            </Link>
            <form action={deleteSet.bind(null, set.id)}>
              <ConfirmSubmit size="md" message={`Delete "${set.title}" and everything in it? Past results stay in your history.`}>
                <Trash2 /> Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <SectionTitle>
            {itemCount} {set.mode === "coding" ? (itemCount === 1 ? "exercise" : "exercises") : itemCount === 1 ? "question" : "questions"}
          </SectionTitle>
          {itemCount === 0 ? (
            <EmptyState
              title="This set is empty"
              description={set.mode === "coding" ? "Add coding exercises to practise or take an assessment." : "Add questions to take an assessment."}
              action={
                <Link href={`/sets/${set.id}/edit`} className={buttonClass("primary")}>
                  <Pencil /> Add {set.mode === "coding" ? "exercises" : "questions"}
                </Link>
              }
            />
          ) : set.mode === "coding" ? (
            <RowList>
              {exercises.map((exercise, index) => (
                <Link key={exercise.id} href={`/codelab/${exercise.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <span className="font-mono text-xs text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{exercise.title}</span>
                    <span className="block text-xs text-fg-subtle">{exerciseTypeLabel(exercise.exercise_type)}</span>
                  </span>
                  <Badge>{languageInfo(exercise.language).label}</Badge>
                  <span className="text-xs text-fg-subtle">{exercise.points} pts</span>
                </Link>
              ))}
            </RowList>
          ) : (
            <RowList>
              {questions.map((question, index) => (
                <details key={question.id} className="group px-4 py-3">
                  <summary className="flex list-none gap-3 text-sm [&::-webkit-details-marker]:hidden">
                    <span className="font-mono text-xs leading-5 text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">{question.prompt}</span>
                    <span className="text-xs text-fg-subtle group-open:hidden">Show answer</span>
                  </summary>
                  <div className="mt-2 ml-8 text-sm text-success">
                    {question.type === "multiple_choice"
                      ? question.answer_options.filter((o) => o.is_correct).map((o) => o.body).join(" · ")
                      : question.accepted_answers.map((a) => a.body).join(" · ")}
                    {question.explanation ? <p className="mt-1 text-fg-muted">{question.explanation}</p> : null}
                  </div>
                </details>
              ))}
            </RowList>
          )}

          {completed.length ? (
            <div className="mt-8">
              <SectionTitle>Past attempts</SectionTitle>
              <RowList>
                {completed.slice(0, 8).map((attempt) => (
                  <AttemptRow key={attempt.id} attempt={attempt} timeZone={profile.timezone} />
                ))}
              </RowList>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{modeLabel(set.mode)}</Badge>
              {set.mode !== "coding" && set.shuffle_questions ? <Badge>Shuffled questions</Badge> : null}
              {set.mode === "multiple_choice" && set.shuffle_options ? <Badge>Shuffled choices</Badge> : null}
            </div>
            {open ? (
              <div className="space-y-3">
                <Notice tone="amber">You have an assessment in progress for this set.</Notice>
                <Link href={`/attempt/${open.id}`} className={buttonClass("primary", "lg", "w-full")}>
                  <Play /> Resume assessment
                </Link>
              </div>
            ) : itemCount > 0 ? (
              <StartAttemptForm setId={set.id} defaultMinutes={set.time_limit_minutes} label={completed.length ? "Retake assessment" : "Start assessment"} />
            ) : (
              <p className="text-sm text-fg-muted">Add at least one item to start an assessment.</p>
            )}
          </Card>
          <Card className="grid grid-cols-3 gap-4 p-5">
            <Stat label="Attempts" value={completed.length} />
            <Stat label="Best" value={scores.length ? formatPercent(Math.max(...scores)) : "—"} />
            <Stat label="Average" value={scores.length ? formatPercent(scores.reduce((a, b) => a + b, 0) / scores.length) : "—"} />
          </Card>
          {docRes?.data ? (
            <Link href={`/library/${docRes.data.id}`} className="flex items-center gap-2.5 rounded-card border border-border bg-surface p-4 text-sm hover:border-border-strong">
              <FileText className="size-4 text-fg-subtle" />
              <span className="min-w-0 flex-1 truncate">Source: {docRes.data.title}</span>
            </Link>
          ) : null}
        </aside>
      </div>
    </>
  );
}
