import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/auth-forms";
import { Logo } from "@/components/logo";
import { getProfile, requireUser } from "@/lib/auth";
import type { AcademicProgram } from "@/lib/types";

export const metadata = { title: "Set up your profile" };

async function Onboarding() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  if (profile?.onboarded) redirect("/dashboard");
  const { data } = await supabase.from("academic_programs").select("*").order("sort_order");
  return (
    <ProfileForm
      onboarding
      programs={(data ?? []) as AcademicProgram[]}
      initial={{
        full_name: profile?.full_name || String(user.user_metadata?.full_name ?? ""),
        program_id: profile?.program_id ?? null,
        custom_program: profile?.custom_program ?? null,
      }}
    />
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold">Tell us what you&apos;re studying</h1>
      <p className="mt-1.5 mb-8 text-sm text-fg-muted">
        Your program decides which study modes you get. Technology programs unlock Fill in the Code and the CodeLab workspace.
      </p>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-muted" />}>
        <Onboarding />
      </Suspense>
    </main>
  );
}
