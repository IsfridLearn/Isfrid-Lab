"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/utils";
import type { AcademicProgram, FormState } from "@/lib/types";

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);

async function readProfileFields(formData: FormData) {
  const { supabase, user } = await requireUser();
  const fullName = text(formData, "full_name", 120);
  const programId = text(formData, "program_id", 40);
  const customProgram = text(formData, "custom_program", 120);
  if (!fullName) return { error: "Enter your name." } as const;
  if (!programId) return { error: "Choose your academic program." } as const;

  const { data: program } = await supabase.from("academic_programs").select("*").eq("id", programId).maybeSingle();
  if (!program) return { error: "Choose your academic program." } as const;
  const p = program as AcademicProgram;
  if (p.allows_custom_name && !customProgram) return { error: "Type the name of your program." } as const;

  return {
    supabase,
    user,
    fields: { full_name: fullName, program_id: p.id, custom_program: p.allows_custom_name ? customProgram : null },
  } as const;
}

function readPreferences(formData: FormData) {
  const goal = Number(formData.get("weekly_goal"));
  const timezone = text(formData, "timezone", 64);
  return {
    ...(Number.isInteger(goal) && goal >= 1 && goal <= 50 ? { weekly_goal: goal } : {}),
    ...(timezone && isValidTimeZone(timezone) ? { timezone } : {}),
  };
}

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = await readProfileFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await parsed.supabase
    .from("profiles")
    .update({ ...parsed.fields, ...readPreferences(formData), onboarded: true })
    .eq("id", parsed.user.id);
  if (error) return { error: "Could not save your profile. Try again." };
  redirect("/dashboard");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = await readProfileFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await parsed.supabase.from("profiles").update(parsed.fields).eq("id", parsed.user.id);
  if (error) return { error: "Could not save your profile. Try again." };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

export async function updatePreferences(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const preferences = readPreferences(formData);
  if (!("weekly_goal" in preferences)) return { error: "Weekly goal must be a whole number from 1 to 50." };
  const { error } = await supabase.from("profiles").update(preferences).eq("id", user.id);
  if (error) return { error: "Could not save your settings. Try again." };
  revalidatePath("/", "layout");
  return { message: "Settings saved." };
}
