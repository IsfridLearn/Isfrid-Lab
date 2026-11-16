"use server";

// Authentication Server Actions: sign in, sign up, sign out and password changes.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { RECOVERY_COOKIE } from "@/lib/security";
import type { FormState } from "@/lib/types";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const text = (formData: FormData, key: string, max = 320) => String(formData.get(key) ?? "").trim().slice(0, max);
const secret = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Public address of this app, used for links in auth emails. */
async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

/** Returns an error message when the password breaks the length rules. */
function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD) return `Use a password with at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use a password with at most ${MAX_PASSWORD} characters.`;
  return null;
}

/** Logs in with email and password. */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) redirect("/setup");
  const email = text(formData, "email");
  const password = secret(formData, "password");
  if (!email || !password || password.length > MAX_PASSWORD) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again." };
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email first — check your inbox for the link we sent."
          : "That email and password don't match an account.",
    };
  }
  redirect("/dashboard");
}

/** Registers an account; the user is signed in only after confirming their email. */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) redirect("/setup");
  const fullName = text(formData, "full_name", 120);
  const email = text(formData, "email");
  const password = secret(formData, "password");
  if (!fullName) return { error: "Enter your name." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding` },
  });
  if (error) {
    if (error.status === 429) return { error: "Too many sign-ups from this network. Try again later." };
    if (error.code === "weak_password") return { error: "That password is too weak or has appeared in a data breach. Choose another." };
    return { error: "We couldn't create the account. If you already have one, log in or reset your password." };
  }
  if (data.session) redirect("/onboarding");
  return { message: "Almost there — we sent a confirmation link to your email. Open it to finish creating your account." };
}

/** Ends the session on this device. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Emails a reset link. Answers the same way whether or not the account exists. */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) redirect("/setup");
  const email = text(formData, "email");
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && error.status === 429) return { error: "Too many requests. Wait a minute and try again." };
  return { message: "If an account uses that email, a reset link is on its way." };
}

/** Reads and checks the new password + confirmation fields. */
function readNewPassword(formData: FormData) {
  const password = secret(formData, "password");
  const problem = passwordProblem(password);
  if (problem) return { error: problem } as const;
  if (password !== secret(formData, "confirm")) return { error: "The two passwords don't match." } as const;
  return { password } as const;
}

/** Sets a new password after a reset link. Only valid right after opening that link. */
export async function setRecoveredPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readNewPassword(formData);
  if ("error" in parsed) return { error: parsed.error };
  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || cookieStore.get(RECOVERY_COOKIE)?.value !== "1") {
    return { error: "Your reset link has expired. Request a new one from the login page." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) return { error: "That password can't be used. Choose a different one." };
  cookieStore.delete(RECOVERY_COOKIE);
  await supabase.auth.signOut({ scope: "others" });
  return { message: "Password updated." };
}

/** Changes the password from Settings. Requires the current password. */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readNewPassword(formData);
  if ("error" in parsed) return { error: parsed.error };
  const current = secret(formData, "current_password");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/login");
  if (!current || current.length > MAX_PASSWORD) return { error: "Enter your current password." };

  const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: current });
  if (check.error) {
    return { error: check.error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Your current password is not correct." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) return { error: "That password can't be used. Choose a different one." };
  await supabase.auth.signOut({ scope: "others" });
  return { message: "Password updated. Other devices have been signed out." };
}
