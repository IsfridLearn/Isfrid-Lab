import { ProfileForm } from "@/components/auth-forms";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { programLabel, requireProfile } from "@/lib/auth";
import { formatDate, formatPercent } from "@/lib/utils";
import type { AcademicProgram } from "@/lib/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user, profile, isTechnical } = await requireProfile();
  const [programsRes, attemptsRes, setsRes, docsRes, solvedRes] = await Promise.all([
    supabase.from("academic_programs").select("*").order("sort_order"),
    supabase.from("assessment_attempts").select("score_percent").eq("status", "completed").limit(2000),
    supabase.from("study_sets").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("coding_submissions").select("exercise_id").eq("status", "passed").limit(5000),
  ]);
  const scores = (attemptsRes.data ?? []).map((a) => Number(a.score_percent));
  const solved = new Set((solvedRes.data ?? []).map((s) => s.exercise_id)).size;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile" description="Your name and academic program. The program decides which study modes you can use." />
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{profile.full_name}</p>
            <p className="text-sm text-fg-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="brand">{programLabel(profile)}</Badge>
            <Badge>{isTechnical ? "CodeLab enabled" : "CodeLab not included"}</Badge>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6 border-t border-border pt-5 sm:grid-cols-4">
          <Stat label="Assessments" value={scores.length} />
          <Stat label="Average score" value={scores.length ? formatPercent(scores.reduce((a, b) => a + b, 0) / scores.length) : "—"} />
          <Stat label="Study sets" value={setsRes.count ?? 0} detail={`${docsRes.count ?? 0} PDFs`} />
          {isTechnical ? <Stat label="Coding solved" value={solved} /> : <Stat label="Member since" value={<span className="text-base">{formatDate(profile.created_at, profile.timezone)}</span>} />}
        </div>
      </Card>
      <Card className="p-5">
        <ProfileForm
          programs={(programsRes.data ?? []) as AcademicProgram[]}
          initial={{ full_name: profile.full_name, program_id: profile.program_id, custom_program: profile.custom_program }}
        />
      </Card>
    </div>
  );
}
