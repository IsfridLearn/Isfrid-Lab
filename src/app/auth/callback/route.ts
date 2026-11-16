// Landing point for links in confirmation and password-reset emails.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { RECOVERY_COOKIE, safeRedirectPath } from "@/lib/security";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Exchanges the emailed code for a session, then redirects to a same-site path. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!isSupabaseConfigured) return go("/setup");
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  let verified = false;
  if (code) {
    verified = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    verified = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })).error;
  }
  if (!verified) return go("/login?error=link");

  if (next === "/reset-password") {
    (await cookies()).set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
  }
  return go(next);
}
