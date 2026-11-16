import Link from "next/link";
import { History } from "lucide-react";
import { ScoreTrend } from "@/components/charts";
import { AttemptRow, RowList } from "@/components/rows";
import { buttonClass, Card, EmptyState, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MODES } from "@/lib/languages";
import { cn, formatDuration, formatPercent } from "@/lib/utils";
import type { Attempt, Subject } from "@/lib/types";

export const metadata = { title: "Assessment History" };

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const { supabase, profile, isTechnical } = await requireProfile();
  const activeMode = MODES.find((m) => m.id === mode)?.id;
  const [attemptsRes, subjectsRes] = await Promise.all([
    supabase.from("assessment_attempts").select("*").eq("status", "completed").order("completed_at", { ascending: false }).limit(500),
    supabase.from("subjects").select("id, name").order("name"),
  ]);
  const all = (attemptsRes.data ?? []) as Attempt[];
  const attempts = activeMode ? all.filter((a) => a.mode === activeMode) : all;
  const subjects = (subjectsRes.data ?? []) as Pick<Subject, "id" | "name">[];
  const scores = attempts.map((a) => Number(a.score_percent));
  const avg = average(scores);
  const tabs = [{ id: undefined as string | undefined, label: "All" }, ...MODES.filter((m) => m.id !== "coding" || isTechnical)];
  const bySubject = subjects
    .map((subject) => ({ subject, scores: attempts.filter((a) => a.subject_id === subject.id).map((a) => Number(a.score_percent)) }))
    .filter((row) => row.scores.length > 0);

  return (
    <>
      <PageHeader title="Assessment History" description="Every completed assessment, with scores, time and a full answer review." />
      <div className="mb-5 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.id ? `/history?mode=${tab.id}` : "/history"}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", activeMode === tab.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {attempts.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No completed assessments yet"
          description="Take an assessment from any study set and it will be recorded here."
          action={
            <Link href="/sets" className={buttonClass("primary")}>
              Go to study sets
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="grid grid-cols-2 gap-6 p-5">
              <Stat label="Completed" value={attempts.length} />
              <Stat label="Average score" value={avg == null ? "—" : formatPercent(avg)} />
              <Stat label="Best score" value={formatPercent(Math.max(...scores))} />
              <Stat label="Time studied" value={formatDuration(attempts.reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0))} />
            </Card>
            <Card className="p-5 lg:col-span-2">
              <p className="mb-3 text-[13px] text-fg-muted">Score trend · last {Math.min(scores.length, 30)} assessments</p>
              <ScoreTrend scores={scores.slice(0, 30).reverse()} className="h-32" />
            </Card>
          </div>

          {bySubject.length ? (
            <Card className="mt-4 p-5">
              <p className="mb-4 text-[13px] text-fg-muted">Average score by subject</p>
              <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                {bySubject.map(({ subject, scores: subjectScores }) => (
                  <Link key={subject.id} href={`/subjects/${subject.id}`} className="group flex items-center gap-3 text-sm">
                    <span className="w-40 truncate group-hover:underline">{subject.name}</span>
                    <ProgressBar value={average(subjectScores) ?? 0} />
                    <span className="w-10 text-right text-xs tabular-nums text-fg-muted">{formatPercent(average(subjectScores) ?? 0)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="mt-8">
            <RowList>
              {attempts.map((attempt) => (
                <AttemptRow key={attempt.id} attempt={attempt} timeZone={profile.timezone} />
              ))}
            </RowList>
            {all.length === 500 ? <p className="mt-3 text-xs text-fg-subtle">Showing your 500 most recent assessments.</p> : null}
          </div>
        </>
      )}
    </>
  );
}
