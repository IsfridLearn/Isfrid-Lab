"use client";

// Free-form editor: pick a language, write code, run it. Nothing is saved or scored.
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, RotateCcw } from "lucide-react";
import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui";
import { ConsoleOutput } from "@/components/workspace";
import { LANGUAGES, languageInfo } from "@/lib/languages";
import { runCode, type RunResult } from "@/lib/runner";
import type { LanguageId } from "@/lib/types";

const SQL_SAMPLE = "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);\nINSERT INTO students (name) VALUES ('Ana'), ('Ben');\n\nSELECT name FROM students ORDER BY name;\n";
const sampleFor = (id: LanguageId) => (id === "sql" ? SQL_SAMPLE : languageInfo(id).sample);

export function Scratchpad({ remoteExecutionEnabled }: { remoteExecutionEnabled: boolean }) {
  const [language, setLanguage] = useState<LanguageId>("python");
  const [drafts, setDrafts] = useState<Partial<Record<LanguageId, string>>>({});
  const [stdin, setStdin] = useState("Ana");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const info = languageInfo(language);
  const code = drafts[language] ?? sampleFor(language);
  const canRun = info.runtime === "browser" || remoteExecutionEnabled;

  const run = async () => {
    setRunning(true);
    setResult(await runCode({ language, code, stdin }));
    setRunning(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link href="/codelab" className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Coding Practice
        </Link>
        <span className="flex-1 truncate text-sm font-medium">Scratchpad</span>
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as LanguageId);
            setResult(null);
          }}
          aria-label="Language"
          className="h-8 w-36 shrink-0 rounded-md border border-border-strong bg-surface px-2 text-[13px] text-fg focus:border-brand focus:outline-none disabled:opacity-70"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={() => setDrafts((d) => ({ ...d, [language]: sampleFor(language) }))}>
          <RotateCcw /> Reset
        </Button>
        <Button size="sm" onClick={run} disabled={running || !canRun} title={canRun ? undefined : "No runtime is configured for this language"}>
          {running ? <Loader2 className="animate-spin" /> : <Play />} Run
        </Button>
      </div>
      <div className="min-h-64 flex-1">
        <CodeEditor language={language} value={code} onChange={(next) => setDrafts((d) => ({ ...d, [language]: next }))} />
      </div>
      <div className="flex h-56 shrink-0 flex-col border-t border-border bg-code-bg sm:flex-row lg:h-[34%]">
        {language !== "sql" ? (
          <label className="flex shrink-0 flex-col border-b border-white/10 sm:w-56 sm:border-r sm:border-b-0">
            <span className="px-3 pt-2 text-[11px] tracking-wide text-white/40 uppercase">Input (stdin)</span>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              spellCheck={false}
              className="min-h-12 flex-1 resize-none bg-transparent px-3 py-1.5 font-mono text-xs text-code-fg focus:outline-none"
            />
          </label>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed" aria-live="polite">
          <ConsoleOutput
            result={result}
            running={running}
            idle={
              canRun
                ? info.runtime === "browser"
                  ? `${info.label} runs inside your browser. Press Run.`
                  : `${info.label} runs on the configured execution service. Press Run.`
                : `${info.label} needs a code execution service, and none is configured for this deployment. Python, JavaScript and SQL run in your browser without one.`
            }
          />
        </div>
      </div>
    </div>
  );
}
