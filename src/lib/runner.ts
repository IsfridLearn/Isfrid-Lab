// Runs code from the browser: Web Workers for JavaScript, Python and SQL; /api/execute for C, C++, Java and PHP.
"use client";

import { languageInfo } from "@/lib/languages";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  error?: string;
}

export interface RunRequest {
  language: string;
  code: string;
  stdin?: string;
  setup?: string;
}

const BROWSER_TIMEOUT_MS = 8000;
const PYTHON_BOOT_TIMEOUT_MS = 60000;

const WORKER_URL: Record<string, string> = {
  javascript: "/runners/js-worker.js",
  python: "/runners/py-worker.js",
  sql: "/runners/sql-worker.js",
};

const pool = new Map<string, { worker: Worker; ready: boolean }>();

function runInWorker(request: RunRequest): Promise<RunResult> {
  const { language } = request;
  const reusable = language !== "javascript";
  let entry = reusable ? pool.get(language) : undefined;
  if (!entry) {
    entry = { worker: new Worker(WORKER_URL[language]), ready: false };
    if (reusable) pool.set(language, entry);
  }
  const { worker } = entry;
  const current = entry;

  return new Promise((resolve) => {
    const discard = () => {
      worker.terminate();
      if (pool.get(language) === current) pool.delete(language);
    };
    const finish = (result: RunResult, kill: boolean) => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (kill || !reusable) discard();
      resolve(result);
    };
    const timeoutMs = language === "python" && !current.ready ? PYTHON_BOOT_TIMEOUT_MS : BROWSER_TIMEOUT_MS;
    const timer = setTimeout(
      () =>
        finish(
          {
            stdout: "",
            stderr: `Stopped: the program ran longer than ${timeoutMs / 1000} seconds (possible infinite loop).`,
            exitCode: null,
            timedOut: true,
          },
          true,
        ),
      timeoutMs,
    );
    worker.onmessage = (event: MessageEvent<RunResult>) => {
      current.ready = true;
      finish(event.data, false);
    };
    worker.onerror = (event) =>
      finish(
        { stdout: "", stderr: "", exitCode: null, error: `The in-browser runtime failed to start: ${event.message || "network error"}` },
        true,
      );
    worker.postMessage({ code: request.code, stdin: request.stdin ?? "", setup: request.setup ?? "" });
  });
}

export async function runCode(request: RunRequest): Promise<RunResult> {
  if (languageInfo(request.language).runtime === "browser") return runInWorker(request);
  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: request.language, code: request.code, stdin: request.stdin ?? "" }),
    });
    const data = (await response.json()) as RunResult;
    return { stdout: data.stdout ?? "", stderr: data.stderr ?? "", exitCode: data.exitCode ?? null, timedOut: data.timedOut, error: data.error };
  } catch {
    return { stdout: "", stderr: "", exitCode: null, error: "Could not reach the server. Check your connection and try again." };
  }
}
