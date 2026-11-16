import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

/** The signed-in user, verified with Supabase Auth. Deduped per request. */
export const getSession = cache(async () => {
  if (!isSupabaseConfigured) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*, program:academic_programs(*)")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

/** For Server Actions and pages that only need a signed-in user. */
export async function requireUser() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** For app pages: signed in AND finished onboarding. */
export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile();
  if (!profile || !profile.onboarded) redirect("/onboarding");
  return { supabase, user, profile, isTechnical: Boolean(profile.program?.is_technical) };
}

export function programLabel(profile: Profile | null) {
  if (!profile?.program) return "No program selected";
  if (profile.program.allows_custom_name && profile.custom_program) return profile.custom_program;
  return profile.program.name;
}
