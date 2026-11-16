// Blocks commits and pushes that contain secrets, ignored paths or attribution lines.
// Usage: check-secrets.mjs [--staged | --all | --markers | --message <file>]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1024 * 1024;

const FORBIDDEN_PATHS = [
  [/(^|\/)\.env(\.[^/]+)?$/, "environment file"],
  [/\.(pem|key|p12|pfx|jks|keystore|crt|cer|der)$/i, "key or certificate file"],
  [/(^|\/)id_(rsa|dsa|ecdsa|ed25519)[^/]*$/, "SSH key"],
  [/(^|\/)(credentials|secrets?|service-account)[^/]*\.(json|ya?ml|txt)$/i, "credentials file"],
  [/(^|\/)[^/]*-service-account\.json$/i, "credentials file"],
  [/(^|\/)(\.npmrc|\.netrc|\.htpasswd)$/, "credentials file"],
  [/\.(dump|bak|backup|sqlite|sqlite3|db)$|\.sql\.gz$/i, "database dump"],
  [/(^|\/)(dumps?|backups?)\//i, "database dump folder"],
  [/^(?!src\/).*?(^|\/)(uploads?|users|user[-_]?data|userdata|users-data)\//i, "user data folder"],
  [/(^|\/)logs\/|\.log$/i, "log file"],
];

const ALLOWED_PATHS = [/(^|\/)\.env\.example$/];

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT (for example a Supabase key)"],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, "Supabase secret key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/, "GitHub token"],
  [/\b[sr]k_(live|test)_[A-Za-z0-9]{16,}/, "Stripe key"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bsk-[A-Za-z0-9_-]{32,}/, "API key"],
  [/\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqps?):\/\/[^\s:@/]+:[^\s@/]+@/i, "connection string with a password"],
  [/(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|service[_-]?role)\w*["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i, "hard-coded credential"],
  [/^\s*(export\s+)?[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|PRIVATE_KEY|SERVICE_ROLE|API_KEY)[A-Z0-9_]*\s*=\s*["']?([^\s"']{12,})/m, "credential in an env assignment"],
];

const PLACEHOLDER = /your-|example|placeholder|changeme|xxxx|<[^>]+>|\$\{|process\.env|env\(|\.\.\./i;
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const list = (...args) => git(...args).split("\0").filter(Boolean);

/** Attribution patterns: the built-in ones plus any listed locally in .git/info/push-blocklist. */
function attributionPatterns() {
  const patterns = [/^\s*co-authored-by:/im, /generated with/i];
  const local = join(git("rev-parse", "--git-dir").trim(), "info", "push-blocklist");
  if (existsSync(local)) {
    for (const line of readFileSync(local, "utf8").split("\n")) {
      if (line.trim() && !line.startsWith("#")) patterns.push(new RegExp(line.trim(), "iu"));
    }
  }
  return patterns;
}
const ATTRIBUTION = attributionPatterns();

/** True when git would ignore this path if it were not already tracked. */
function isIgnored(path) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Returns the reason a path may not be committed, or null. */
function pathProblem(path) {
  if (ALLOWED_PATHS.some((pattern) => pattern.test(path))) return null;
  const hit = FORBIDDEN_PATHS.find(([pattern]) => pattern.test(path));
  if (hit) return hit[1];
  return isIgnored(path) ? "path is listed in .gitignore" : null;
}

/** Returns "line N: kind" for every secret-looking string in the text. */
function secretProblems(text) {
  const problems = [];
  text.split("\n").forEach((line, index) => {
    for (const [pattern, kind] of SECRET_PATTERNS) {
      const match = pattern.exec(line);
      if (match && !PLACEHOLDER.test(match[0])) problems.push(`line ${index + 1}: ${kind}`);
    }
  });
  return problems;
}

/** Scans a set of files; `read` returns the content to check for a path. */
function scan(paths, read, { markers = false } = {}) {
  const findings = [];
  for (const path of paths) {
    const reason = pathProblem(path);
    if (reason) {
      findings.push(`${path}: ${reason}`);
      continue;
    }
    let text;
    try {
      text = read(path);
    } catch {
      continue;
    }
    if (text.length > MAX_BYTES || text.includes("\u0000")) continue;
    for (const problem of secretProblems(text)) findings.push(`${path}: ${problem}`);
    if (markers && !/^scripts\/check-secrets\.mjs$|^README\.md$|^src\/app\/page\.tsx$/.test(path)) {
      text.split("\n").forEach((line, index) => {
        if (ATTRIBUTION.some((pattern) => pattern.test(line))) findings.push(`${path}: line ${index + 1}: tool or attribution mention`);
      });
    }
  }
  return findings;
}

const mode = process.argv[2] ?? "--staged";
let findings = [];
if (mode === "--message") {
  const message = readFileSync(process.argv[3], "utf8").replace(/^#.*$/gm, "");
  findings = ATTRIBUTION.filter((pattern) => pattern.test(message)).map(() => "commit message contains a co-author, generated-with or tool mention");
  findings = [...new Set(findings)];
} else if (mode === "--all" || mode === "--markers") {
  findings = scan(list("ls-files", "-z"), (path) => readFileSync(path, "utf8"), { markers: mode === "--markers" });
} else {
  findings = scan(list("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"), (path) => git("show", `:${path}`));
}

if (findings.length) {
  console.error("\nBlocked: sensitive content found.\n");
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error("\nRemove it (git restore --staged <file>) and try again.\n");
  process.exit(1);
}
