import Link from "next/link";
import { ArrowRight, BookOpen, FileUp, Flame, Layers, Play, Plus, Target } from "lucide-react";
import { ActivityGrid, WeekBars } from "@/components/charts";
import { AttemptRow, DocumentRowLink, RowList, SetRow } from "@/components/rows";
import { buttonClass, Card, EmptyState, ProgressBar, SectionTitle, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { modeLabel, subjectColorClass } from "@/lib/languages";
import { addDays, cn, formatPercent, localDate, summarizeProgress } from "@/lib/utils";
import type { Attempt, DocumentRow, ProgressDay, StudySet, Subject } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, profile, isTechnical } = await requireProfile();
  const tz = profile.timezone;
  const today = localDate(tz);

  const [setsRes, setCountRes, subjectsRes, docsRes, recentRes, openRes, progressRes, scoresRes] = await Promise.all([
    supabase.from("study_sets").select("*").order("updated_at", { ascending: false }).limit(4),
    supabase.from("study_sets").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("*").order("created_at", { ascending: false }).limit(6),
    supabase.from("documents").select("id, subject_id, title, file_name, storage_path, size_bytes, page_count, char_count, created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("assessment_attempts").select("*").eq("status", "completed").order("completed_at", { ascending: false }).limit(5),
    supabase.from("assessment_attempts").select("*").eq("status", "in_progress").order("started_at", { ascending: false }).limit(1),
    supabase.from("user_progress").select("*").gte("activity_date", addDays(today, -104)).order("activity_date"),
    supabase.from("assessment_attempts").select("score_percent").eq("status", "completed").order("completed_at", { ascending: false }).limit(200),
  ]);

  const sets = (setsRes.data ?? []) as StudySet[];
  const subjects = (subjectsRes.data ?? []) as Subject[];
  const docs = (docsRes.data ?? []) as DocumentRow[];
  const recent = (recentRes.data ?? []) as Attempt[];
  const open = ((openRes.data ?? []) as Attempt[])[0];
  const progress = summarizeProgress((progressRes.data ?? []) as ProgressDay[], today);
  const scores = (scoresRes.data ?? []).map((row) => Number(row.score_percent));
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name;
  const firstName = profile.full_name.split(/\s+/)[0] || "there";
  const isNew = sets.length === 0 && docs.length === 0 && subjects.length === 0;
  const goalPct = (progress.weekAssessments / profile.weekly_goal) * 100;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {progress.studiedToday
              ? "You've studied today. Keep the streak going tomorrow."
              : progress.streak > 0
                ? `Study today to extend your ${progress.streak}-day streak.`
                : "Complete an assessment to start a streak."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/library/upload" className={buttonClass("secondary")}>
            <FileUp /> Upload PDF
          </Link>
          <Link href="/sets/new" className={buttonClass("primary")}>
            <Plus /> New study set
          </Link>
        </div>
      </header>

      {isNew ? (
        <Card className="mb-8 p-6">
          <h2 className="text-base font-semibold">Get started in three steps</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { href: "/subjects", icon: BookOpen, title: "Add a subject", body: "Group materials by course, like Data Structures or Networking." },
              { href: "/library/upload", icon: FileUp, title: "Upload a PDF", body: "ISFRID extracts the text so you can quote it in questions." },
              { href: "/sets/new", icon: Layers, title: "Create a study set", body: `Multiple choice, identification${isTechnical ? " or Fill in the Code" : ""}.` },
            ].map((step, index) => (
              <li key={step.href}>
                <Link href={step.href} className="group block rounded-lg border border-border p-4 transition-colors hover:border-brand">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="font-mono text-xs text-fg-subtle">0{index + 1}</span>
                    <step.icon className="size-4 text-brand-text" />
                    {step.title}
                  </span>
                  <span className="mt-1.5 block text-sm text-fg-muted">{step.body}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="grid grid-cols-2 items-center gap-6 p-5 sm:grid-cols-4 lg:col-span-2">
          <Stat label="Study sets" value={setCountRes.count ?? 0} />
          <Stat label="Assessments" value={progress.totals.assessments} detail="last 15 weeks" />
          <Stat label="Average score" value={average == null ? "—" : formatPercent(average)} />
          <Stat
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Flame className={cn("size-5", progress.streak > 0 ? "text-amber" : "text-fg-subtle")} />
                {progress.streak}
              </span>
            }
            detail={progress.streak === 1 ? "day" : "days"}
          />
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-[13px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Target className="size-4" /> Weekly goal
            </span>
            <Link href="/settings" className="text-xs hover:text-fg hover:underline">
              Change
            </Link>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {progress.weekAssessments}
            <span className="text-base font-normal text-fg-subtle"> / {profile.weekly_goal}</span>
          </div>
          <ProgressBar value={goalPct} tone="amber" className="mt-3" />
          <p className="mt-2 text-xs text-fg-subtle">
            {goalPct >= 100 ? "Goal reached this week." : `${profile.weekly_goal - progress.weekAssessments} more to reach your goal.`}
          </p>
        </Card>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <SectionTitle>Continue studying</SectionTitle>
            {open ? (
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-xs text-fg-subtle">Assessment in progress · {modeLabel(open.mode)}</p>
                  <p className="mt-0.5 truncate text-base font-medium">{open.set_title}</p>
                </div>
                <Link href={`/attempt/${open.id}`} className={buttonClass("primary")}>
                  <Play /> Resume
                </Link>
              </Card>
            ) : sets[0] ? (
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-xs text-fg-subtle">Most recent set · {modeLabel(sets[0].mode)}</p>
                  <p className="mt-0.5 truncate text-base font-medium">{sets[0].title}</p>
                </div>
                <Link href={`/sets/${sets[0].id}`} className={buttonClass("primary")}>
                  Open <ArrowRight />
                </Link>
              </Card>
            ) : (
              <EmptyState icon={<Layers />} title="Nothing to continue yet" description="Create a study set and it will show up here." />
            )}
          </section>

          <section>
            <SectionTitle action={<Link href="/sets" className="text-[13px] text-fg-muted hover:text-fg">View all</Link>}>
              Recent study materials
            </SectionTitle>
            {sets.length || docs.length ? (
              <RowList>
                {sets.map((set) => (
                  <SetRow key={set.id} set={set} subjectName={subjectName(set.subject_id)} />
                ))}
                {docs.map((doc) => (
                  <DocumentRowLink key={doc.id} doc={doc} subjectName={subjectName(doc.subject_id)} timeZone={tz} />
                ))}
              </RowList>
            ) : (
              <EmptyState icon={<FileUp />} title="No study materials yet" description="Upload a PDF or create a study set to begin." />
            )}
          </section>

          <section>
            <SectionTitle action={<Link href="/history" className="text-[13px] text-fg-muted hover:text-fg">View all</Link>}>
              Recent assessment results
            </SectionTitle>
            {recent.length ? (
              <RowList>
                {recent.map((attempt) => (
                  <AttemptRow key={attempt.id} attempt={attempt} timeZone={tz} />
                ))}
              </RowList>
            ) : (
              <EmptyState title="No results yet" description="Your scores appear here after your first assessment." />
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionTitle>This week</SectionTitle>
            <Card className="p-5">
              <WeekBars week={progress.week} today={today} />
              <p className="mt-3 text-xs text-fg-subtle">Questions and exercises answered per day.</p>
            </Card>
          </section>

          <section>
            <SectionTitle>Learning activity</SectionTitle>
            <Card className="p-5">
              <ActivityGrid byDate={progress.byDate} today={today} />
              <p className="mt-3 text-xs text-fg-subtle">
                {progress.totals.items} answered, {progress.totals.correct} correct
                {isTechnical ? `, ${progress.totals.coding} coding exercises solved` : ""} in the last 15 weeks.
              </p>
            </Card>
          </section>

          <section>
            <SectionTitle action={<Link href="/subjects" className="text-[13px] text-fg-muted hover:text-fg">View all</Link>}>
              My subjects
            </SectionTitle>
            {subjects.length ? (
              <RowList>
                {subjects.map((subject) => (
                  <Link key={subject.id} href={`/subjects/${subject.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60">
                    <span className={cn("size-2.5 rounded-full", subjectColorClass[subject.color] ?? "bg-slate-500")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{subject.name}</span>
                    {subject.code ? <span className="text-xs text-fg-subtle">{subject.code}</span> : null}
                  </Link>
                ))}
              </RowList>
            ) : (
              <EmptyState title="No subjects yet" action={<Link href="/subjects" className={buttonClass("secondary", "sm")}>Add a subject</Link>} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
