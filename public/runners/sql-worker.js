// Runs SQL against a throwaway in-memory SQLite database (sql.js) inside a Web Worker.
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";
importScripts(CDN + "sql-wasm.js");

const runtime = initSqlJs({ locateFile: (file) => CDN + file });

function formatResults(results) {
  return results
    .map((set) => {
      const rows = set.values.map((row) => row.map((cell) => (cell === null ? "NULL" : String(cell))).join("|"));
      return [set.columns.join("|"), ...rows].join("\n");
    })
    .join("\n\n");
}

self.onmessage = async (event) => {
  const { code, setup } = event.data;
  let SQL;
  try {
    SQL = await runtime;
  } catch (error) {
    self.postMessage({ stdout: "", stderr: "", exitCode: null, error: `Could not load the SQL runtime: ${error}` });
    return;
  }

  const db = new SQL.Database();
  try {
    if (setup && setup.trim()) {
      try {
        db.run(setup);
      } catch (error) {
        self.postMessage({ stdout: "", stderr: `Error in the exercise's setup SQL: ${error.message || error}`, exitCode: 1 });
        return;
      }
    }
    try {
      const results = db.exec(code);
      const stdout = results.length ? formatResults(results) + "\n" : "";
      self.postMessage({ stdout, stderr: "", exitCode: 0 });
    } catch (error) {
      self.postMessage({ stdout: "", stderr: `SQL error: ${error.message || error}`, exitCode: 1 });
    }
  } finally {
    db.close();
  }
};
