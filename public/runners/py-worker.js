// Runs a student's Python with Pyodide (CPython in WebAssembly) inside a Web Worker.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const runtime = loadPyodide();

self.onmessage = async (event) => {
  const { code, stdin } = event.data;
  let pyodide;
  try {
    pyodide = await runtime;
  } catch (error) {
    self.postMessage({ stdout: "", stderr: "", exitCode: null, error: `Could not load the Python runtime: ${error}` });
    return;
  }

  const out = [];
  const err = [];
  const lines = stdin === "" ? [] : stdin.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  let cursor = 0;
  pyodide.setStdin({ stdin: () => (cursor < lines.length ? lines[cursor++] : undefined) });
  pyodide.setStdout({ raw: (byte) => out.push(byte) });
  pyodide.setStderr({ raw: (byte) => err.push(byte) });

  const decode = (bytes) => new TextDecoder().decode(new Uint8Array(bytes));
  let exitCode = 0;
  let trace = "";
  const globals = pyodide.toPy({ __name__: "__main__" });
  try {
    await pyodide.runPythonAsync(code, { globals, filename: "main.py" });
  } catch (error) {
    exitCode = 1;
    const message = String(error && error.message ? error.message : error);
    const kept = [];
    let skipping = false;
    for (const line of message.split("\n")) {
      if (/File "\/lib\/python|_pyodide/.test(line)) {
        skipping = true;
        continue;
      }
      if (skipping && /^\s{4}/.test(line)) continue;
      skipping = false;
      kept.push(line);
    }
    trace = kept.join("\n").replace(/^PythonError:\s*/, "");
    if (/SystemExit/.test(trace)) {
      exitCode = 0;
      trace = "";
    }
  } finally {
    try {
      pyodide.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
    } catch {}
    globals.destroy();
  }
  self.postMessage({ stdout: decode(out), stderr: decode(err) + trace, exitCode });
};
