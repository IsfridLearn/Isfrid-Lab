import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SubjectFormButton } from "@/components/forms";
import { EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { subjectColorClass } from "@/lib/languages";
import { cn, formatPercent } from "@/lib/utils";
import type { Subject } from "@/lib/types";

export const metadata = { title: "My Subjects" };

export default async function SubjectsPage() {
  const { supabase } = await requireProfile();
  const [subjectsRes, setsRes, docsRes, attemptsRes] = await Promise.all([
    supabase.from("subjects").select("*").order("name"),
    supabase.from("study_sets").select("subject_id").not("subject_id", "is", null),
    supabase.from("documents").select("subject_id").not("subject_id", "is", null),
    supabase.from("assessment_attempts").select("subject_id, score_percent").eq("status", "completed").not("subject_id", "is", null).limit(2000),
  ]);
  const subjects = (subjectsRes.data ?? []) as Subject[];
  const count = (rows: { subject_id: unknown }[] | null, id: string) => (rows ?? []).filter((r) => r.subject_id === id).length;

  return (
    <>
      <PageHeader
        title="My Subjects"
        description="Organize PDFs, study sets and results by course."
        actions={<SubjectFormButton />}
      />
      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No subjects yet"
          description="Create one for each course you're taking — Programming 1, Database Management Systems, Networking…"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const scores = (attemptsRes.data ?? []).filter((a) => a.subject_id === subject.id).map((a) => Number(a.score_percent));
            const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
            return (
              <Link
                key={subject.id}
                href={`/subjects/${subject.id}`}
                className="group rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("size-2.5 rounded-full", subjectColorClass[subject.color] ?? "bg-slate-500")} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{subject.name}</span>
                  {subject.code ? <span className="text-xs text-fg-subtle">{subject.code}</span> : null}
                </div>
                <p className="mt-3 text-[13px] text-fg-muted">
                  {count(setsRes.data, subject.id)} study sets · {count(docsRes.data, subject.id)} PDFs · {scores.length} attempts
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={average ?? 0} />
                  <span className="w-10 text-right text-xs tabular-nums text-fg-muted">{average == null ? "—" : formatPercent(average)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
