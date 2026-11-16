"use client";

import dynamic from "next/dynamic";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { useIsDark } from "@/components/client-ui";
import { languageInfo } from "@/lib/languages";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-24 items-center justify-center text-fg-subtle">
      <Loader2 className="size-4 animate-spin" />
    </div>
  ),
});

export type EditorInstance = Parameters<OnMount>[0];

/** Turns off JS/TS error squiggles: exercise code has blanks (__1__) and JSX, so they would only mislead. */
const quietDiagnostics: BeforeMount = (monaco) => {
  const ts = monaco.languages.typescript;
  for (const defaults of [ts?.javascriptDefaults, ts?.typescriptDefaults]) {
    defaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
  }
};

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly,
  height = "100%",
  onMount,
}: {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string | number;
  onMount?: (editor: EditorInstance) => void;
}) {
  const dark = useIsDark();
  return (
    <Monaco
      height={height}
      language={languageInfo(language).monaco}
      theme={dark ? "vs-dark" : "light"}
      value={value}
      onChange={(next) => onChange?.(next ?? "")}
      beforeMount={quietDiagnostics}
      onMount={(editor) => onMount?.(editor)}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13.5,
        lineHeight: 21,
        fontFamily: "var(--font-geist-mono), ui-monospace, Consolas, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        renderLineHighlight: readOnly ? "none" : "line",
        padding: { top: 12, bottom: 12 },
        overviewRulerLanes: 0,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        domReadOnly: readOnly,
      }}
    />
  );
}
