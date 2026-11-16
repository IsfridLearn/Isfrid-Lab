import Link from "next/link";
import { CheckCircle2, Circle, CircleDashed, Lock, Plus, SquareTerminal, Terminal } from "lucide-react";
import { Badge, buttonClass, Card, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { programLabel, requireProfile } from "@/lib/auth";
import { isRemoteExecutionConfigured } from "@/lib/execution";
import { exerciseTypeLabel, LANGUAGES, languageInfo } from "@/lib/languages";
import { cn } from "@/lib/utils";

export const metadata = { title: "Coding Practice" };

interface ExerciseRow {
  id: string;
  set_id: string;
  title: string;
  exercise_type: string;
  language: string;
  validation: string;
  points: number;
  position: number;
}

export default async function CodeLabPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const { supabase, profile, isTechnical } = await requireProfile();

  if (!isTechnical) {
    return (
      <>
        <PageHeader title="Coding Practice" />
        <EmptyState
          icon={<Lock />}
          title="CodeLab is for technology programs"
          description={
            <>
              Fill in the Code is available to BSIT, BSCS, BSIS, Software Engineering, Computer Engineering and other technology-related
              programs. Your profile says <strong>{programLabel(profile)}</strong>. If that&apos;s not right, update your program.
            </>
          }
          action={
            <Link href="/profile" className={buttonClass("primary")}>
              Update my program
            </Link>
          }
        />
      </>
    );
  }

  const [exercisesRes, setsRes, submissionsRes] = await Promise.all([
    supabase.from("coding_exercises").select("id, set_id, title, exercise_type, language, validation, points, position").order("position"),
    supabase.from("study_sets").select("id, title").eq("mode", "coding").order("updated_at", { ascending: false }),
    supabase.from("coding_submissions").select("exercise_id, status").order("created_at", { ascending: false }).limit(5000),
  ]);
  const all = (exercisesRes.data ?? []) as ExerciseRow[];
  const exercises = lang ? all.filter((e) => e.language === lang) : all;
  const sets = setsRes.data ?? [];
  const submissions = submissionsRes.data ?? [];
  const solved = new Set(submissions.filter((s) => s.status === "passed").map((s) => s.exercise_id as string));
  const tried = new Set(submissions.map((s) => s.exercise_id as string));
  const usedLanguages = LANGUAGES.filter((l) => all.some((e) => e.language === l.id));
  const needsRemote = !isRemoteExecutionConfigured && all.some((e) => e.validation === "tests" && languageInfo(e.language).runtime === "remote");

  return (
    <>
      <PageHeader
        title="Coding Practice"
        description="ISFRID CodeLab — every coding exercise you've written, ready to practise outside an assessment."
        actions={
          <>
            <Link href="/codelab/scratch" className={buttonClass("secondary")}>
              <SquareTerminal /> Scratchpad
            </Link>
            <Link href="/sets/new?mode=coding" className={buttonClass("primary")}>
              <Plus /> New coding set
            </Link>
          </>
        }
      />

      <Card className="mb-6 grid grid-cols-3 gap-6 p-5">
        <Stat label="Exercises" value={all.length} />
        <Stat label="Solved" value={all.filter((e) => solved.has(e.id)).length} detail={all.length ? `${Math.round((all.filter((e) => solved.has(e.id)).length / all.length) * 100)}% of your exercises` : undefined} />
        <Stat label="Submissions" value={submissions.length} />
      </Card>

      {needsRemote ? (
        <Notice tone="amber" className="mb-6">
          Some exercises run test cases in C, C++, Java or PHP. Those need a code execution service, which is not configured for this
          deployment, so they can&apos;t be run or submitted yet. Python, JavaScript and SQL run in your browser, and exercises checked by
          matching blanks, output or a solution work in every language.
        </Notice>
      ) : null}

      {usedLanguages.length > 1 ? (
        <div className="mb-5 flex flex-wrap gap-1">
          {[{ id: undefined as string | undefined, label: "All languages" }, ...usedLanguages].map((l) => (
            <Link
              key={l.label}
              href={l.id ? `/codelab?lang=${l.id}` : "/codelab"}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors", lang === l.id ? "bg-muted text-fg" : "text-fg-muted hover:text-fg")}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}

      {all.length === 0 ? (
        <EmptyState
          icon={<Terminal />}
          title="No coding exercises yet"
          description="Create a Fill in the Code study set, then add exercises: blank out code, ask for program output, or give broken code to debug."
          action={
            <Link href="/sets/new?mode=coding" className={buttonClass("primary")}>
              <Plus /> Create a coding set
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {sets
            .filter((set) => exercises.some((e) => e.set_id === set.id))
            .map((set) => (
              <section key={set.id}>
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/sets/${set.id}`} className="text-sm font-semibold hover:underline">
                    {set.title}
                  </Link>
                  <Link href={`/sets/${set.id}/edit`} className="text-[13px] text-fg-muted hover:text-fg">
                    Edit
                  </Link>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                  {exercises
                    .filter((e) => e.set_id === set.id)
                    .map((exercise) => (
                      <Link key={exercise.id} href={`/codelab/${exercise.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                        {solved.has(exercise.id) ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Solved" />
                        ) : tried.has(exercise.id) ? (
                          <CircleDashed className="size-4 shrink-0 text-amber" aria-label="Attempted" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-fg-subtle" aria-label="Not attempted" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{exercise.title}</span>
                          <span className="block text-xs text-fg-subtle">{exerciseTypeLabel(exercise.exercise_type)}</span>
                        </span>
                        <Badge>{languageInfo(exercise.language).label}</Badge>
                        <span className="w-12 text-right text-xs text-fg-subtle">{exercise.points} pts</span>
                      </Link>
                    ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
