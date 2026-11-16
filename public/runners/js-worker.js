// Runs a student's JavaScript in a dedicated Web Worker with no network access.

for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "navigator"]) {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
  } catch {}
}

function format(value, depth = 0) {
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
  if (typeof value === "bigint") return `${value}n`;
  if (value instanceof Error) return value.stack || String(value);
  if (value === null || typeof value !== "object") return String(value);
  if (depth > 3) return Array.isArray(value) ? "[Array]" : "[Object]";
  if (Array.isArray(value)) return `[ ${value.map((v) => format(v, depth + 1)).join(", ")} ]`.replace("[  ]", "[]");
  if (value instanceof Map) return `Map(${value.size}) { ${[...value].map(([k, v]) => `${format(k, depth + 1)} => ${format(v, depth + 1)}`).join(", ")} }`;
  if (value instanceof Set) return `Set(${value.size}) { ${[...value].map((v) => format(v, depth + 1)).join(", ")} }`;
  const entries = Object.entries(value).map(([k, v]) => `${k}: ${format(v, depth + 1)}`);
  return entries.length ? `{ ${entries.join(", ")} }` : "{}";
}

self.onmessage = async (event) => {
  const { code, stdin } = event.data;
  let stdout = "";
  let stderr = "";
  const lines = stdin === "" ? [] : stdin.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  let cursor = 0;
  const readline = () => (cursor < lines.length ? lines[cursor++] : null);
  const print = (...args) => {
    stdout += args.map((a) => format(a)).join(" ") + "\n";
  };
  const printError = (...args) => {
    stderr += args.map((a) => format(a)).join(" ") + "\n";
  };
  const consoleShim = { log: print, info: print, debug: print, table: print, warn: printError, error: printError };
  const processShim = {
    stdout: { write: (text) => void (stdout += String(text)) },
    stderr: { write: (text) => void (stderr += String(text)) },
    argv: ["node", "main.js"],
    exit: () => {
      throw { __exit: true };
    },
  };
  const requireShim = (name) => {
    if (name === "fs" || name === "node:fs") return { readFileSync: () => stdin };
    throw new Error(`Cannot find module '${name}' (modules are not available in the ISFRID sandbox)`);
  };

  let exitCode = 0;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const program = new AsyncFunction("console", "readline", "prompt", "process", "require", code);
    await program(consoleShim, readline, readline, processShim, requireShim);
  } catch (error) {
    if (!(error && error.__exit)) {
      exitCode = 1;
      stderr += (error instanceof Error ? `${error.name}: ${error.message}` : String(error)) + "\n";
    }
  }
  self.postMessage({ stdout, stderr, exitCode });
};
