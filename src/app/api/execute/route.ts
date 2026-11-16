// "Run" for C, C++, Java and PHP: forwards code to the sandbox service. Never executes it here.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { executeRemote, MAX_CODE_BYTES, MAX_STDIN_BYTES, RATE_LIMIT_MESSAGE, takeExecutionTokens } from "@/lib/execution";
import { languageInfo, LANGUAGES } from "@/lib/languages";
import { isSameOrigin } from "@/lib/security";

const MAX_BODY_BYTES = MAX_CODE_BYTES + MAX_STDIN_BYTES + 1024;

/** Signed-in, same-origin, size-limited and rate-limited code execution. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in to run code." }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let body: { language?: unknown; code?: unknown; stdin?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!body || typeof body.language !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!LANGUAGES.some((l) => l.id === body.language) || languageInfo(body.language).runtime !== "remote") {
    return NextResponse.json({ error: "This language does not run on the execution service." }, { status: 400 });
  }
  if (!(await takeExecutionTokens(supabase, 1))) {
    return NextResponse.json({ stdout: "", stderr: "", exitCode: null, error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }
  const result = await executeRemote(body.language, body.code, typeof body.stdin === "string" ? body.stdin : "");
  return NextResponse.json(result);
}
