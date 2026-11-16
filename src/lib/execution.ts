// Remote code execution for C, C++, Java and PHP through an isolated sandbox service (Judge0 or Piston).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { languageInfo } from "@/lib/languages";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  error?: string;
}

const provider = (process.env.CODE_EXECUTION_PROVIDER ?? "").toLowerCase();
const baseUrl = (process.env.CODE_EXECUTION_URL ?? "").replace(/\/+$/, "");
const apiKey = process.env.CODE_EXECUTION_API_KEY ?? "";

export const isRemoteExecutionConfigured = (provider === "piston" || provider === "judge0") && baseUrl.length > 0;

export const MAX_CODE_BYTES = 64 * 1024;
export const MAX_STDIN_BYTES = 64 * 1024;

export const NOT_CONFIGURED_MESSAGE =
  "Running this language needs a code execution service, and none is configured for this deployment. Set CODE_EXECUTION_PROVIDER and CODE_EXECUTION_URL (see README). Exercises checked by matching blanks, output or a solution still work.";

export const RATE_LIMIT_MESSAGE = "You're running code too quickly. Wait a minute and try again.";

/** Charges the signed-in user's per-minute run quota in the database. False when it is used up. */
export async function takeExecutionTokens(supabase: SupabaseClient, count: number) {
  const { data, error } = await supabase.rpc("take_execution_tokens", { tokens: Math.max(1, Math.min(10, count)) });
  return !error && data === true;
}

export async function executeRemote(language: string, code: string, stdin: string): Promise<RunResult> {
  const fail = (error: string): RunResult => ({ stdout: "", stderr: "", exitCode: null, error });
  if (!isRemoteExecutionConfigured) return fail(NOT_CONFIGURED_MESSAGE);
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) return fail("Code is larger than the 64 KB limit.");
  if (new TextEncoder().encode(stdin).length > MAX_STDIN_BYTES) return fail("Input is larger than the 64 KB limit.");

  const info = languageInfo(language);
  try {
    return provider === "piston" ? await runPiston(info, code, stdin) : await runJudge0(info, code, stdin);
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "could not be reached";
    return fail(`The code execution service ${reason}. Try again in a moment.`);
  }
}

type Info = ReturnType<typeof languageInfo>;

async function runPiston(info: Info, code: string, stdin: string): Promise<RunResult> {
  const response = await fetch(`${baseUrl}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: apiKey } : {}) },
    body: JSON.stringify({
      language: info.piston,
      version: "*",
      files: [{ name: info.fileName, content: code }],
      stdin,
      compile_timeout: 10000,
      run_timeout: 5000,
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!response.ok) {
    return { stdout: "", stderr: "", exitCode: null, error: `The code execution service answered with HTTP ${response.status}.` };
  }
  const data = (await response.json()) as {
    compile?: { stderr?: string; code?: number | null };
    run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
  };
  if (data.compile && data.compile.code !== 0 && data.compile.code != null) {
    return { stdout: "", stderr: data.compile.stderr ?? "Compilation failed.", exitCode: data.compile.code };
  }
  return {
    stdout: data.run?.stdout ?? "",
    stderr: data.run?.stderr ?? "",
    exitCode: data.run?.code ?? null,
    timedOut: data.run?.signal === "SIGKILL",
  };
}

async function runJudge0(info: Info, code: string, stdin: string): Promise<RunResult> {
  const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
  const unb64 = (text?: string | null) => (text ? Buffer.from(text, "base64").toString("utf8") : "");
  const host = new URL(baseUrl).host;
  const authHeaders: Record<string, string> = !apiKey
    ? {}
    : host.endsWith("rapidapi.com")
      ? { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": host }
      : { "X-Auth-Token": apiKey };

  const response = await fetch(`${baseUrl}/submissions?base64_encoded=true&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      language_id: info.judge0Id,
      source_code: b64(code),
      stdin: b64(stdin),
      cpu_time_limit: 5,
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!response.ok) {
    const quota = response.status === 429 ? " The service's request quota has been used up." : "";
    return { stdout: "", stderr: "", exitCode: null, error: `The code execution service answered with HTTP ${response.status}.${quota}` };
  }
  const data = (await response.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    exit_code?: number | null;
    status?: { id: number; description: string };
  };
  const statusId = data.status?.id ?? 0;
  if (statusId === 6) return { stdout: "", stderr: unb64(data.compile_output) || "Compilation failed.", exitCode: 1 };
  return {
    stdout: unb64(data.stdout),
    stderr: unb64(data.stderr) || (statusId > 4 ? (data.status?.description ?? "") : ""),
    exitCode: data.exit_code ?? (statusId === 3 || statusId === 4 ? 0 : 1),
    timedOut: statusId === 5,
  };
}
