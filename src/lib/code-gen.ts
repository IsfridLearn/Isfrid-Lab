// Rule-based coding exercise drafting: finds code snippets in PDF text and blanks out parts of them.
import { languageInfo } from "@/lib/languages";
import type { Blank, ExerciseType, LanguageId } from "@/lib/types";

export type BlankKind = "keywords" | "functions" | "variables";

export interface CodeSnippet {
  code: string;
  page: number;
  language: LanguageId | null;
}

export interface CodeDraft {
  key: string;
  page: number;
  language: LanguageId;
  exerciseType: ExerciseType;
  title: string;
  template: string;
  solution: string;
  blanks: Blank[];
}

export const BLANK_KINDS: { id: BlankKind; label: string; exerciseType: ExerciseType; noun: string }[] = [
  { id: "keywords", label: "Keywords", exerciseType: "missing_code", noun: "keywords" },
  { id: "functions", label: "Function names", exerciseType: "missing_functions", noun: "function names" },
  { id: "variables", label: "Variables and values", exerciseType: "missing_variables", noun: "variables and values" },
];

const MAX_DRAFTS = 30;
const MAX_BLANKS = 3;
const MIN_LINES = 3;
const MAX_LINES = 40;

const CODE_LINE = [
  /;\s*$/,
  /[{}]\s*$/,
  /^\s*[{}]/,
  /^\s*#include\b/,
  /^\s*<\?php/,
  /^\s*\?>\s*$/,
  /^\s*(def|class)\s+\w+.*:\s*$/,
  /^\s*(for|while|if|elif|else|try|except|finally|with)\b.*:\s*$/,
  /\b(console\.log|System\.out\.print\w*|printf|print|echo|puts)\s*\(/,
  /\b(cout|cin)\s*(<<|>>)/,
  /^\s*echo\s+["'$]/,
  /^\s*from\s+[\w.]+\s+import\s+/,
  /^\s*import\s+[\w.*{}, ]+;?\s*$/,
  /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|FROM|WHERE|ORDER BY|GROUP BY|HAVING|VALUES|SET|(INNER |LEFT |RIGHT )?JOIN)\b/,
  /^\s*(return|break|continue)\b/,
  /^\s*\$?[A-Za-z_][\w.[\]$]*\s*(=(?!=)|\+=|-=|\*=|\/=|(\+\+|--)\s*;?\s*$)/,
  /^\s*(int|float|double|char|string|String|bool|boolean|long|void|const|let|var|auto|public|private|protected|static|final|function)\s+[\w<>[\]$]+/,
  /^\s*[\w.$]+\([^)]*\)\s*;?\s*$/,
];
const PROSE_END = /[A-Za-z][.?!]["')]?$/;

const isCodeLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 160) return false;
  if (PROSE_END.test(trimmed) && !/[;{}=()]/.test(trimmed)) return false;
  return CODE_LINE.some((pattern) => pattern.test(line));
};

const SIGNS: [LanguageId, RegExp, number][] = [
  ["php", /<\?php/, 6],
  ["php", /\$[A-Za-z_]\w*/, 2],
  ["php", /\becho\b/, 2],
  ["php", /\bforeach\s*\(\s*\$/, 3],
  ["cpp", /#include\s*<(iostream|vector|string|bits\/stdc\+\+\.h|map|algorithm)>/, 6],
  ["cpp", /\bstd::|\bcout\b|\bcin\b|\bendl\b/, 4],
  ["cpp", /using\s+namespace\s+std/, 6],
  ["c", /#include\s*<(stdio|stdlib|string|math)\.h>/, 6],
  ["c", /\b(printf|scanf)\s*\(/, 3],
  ["java", /\bpublic\s+(static\s+)?(class|void)\b/, 4],
  ["java", /System\.out\.print/, 6],
  ["java", /\bString\[\]|\b(ArrayList|Scanner|HashMap)\b/, 3],
  ["javascript", /console\.log/, 6],
  ["javascript", /\b(const|let)\s+\w+\s*=/, 2],
  ["javascript", /=>|===|!==/, 2],
  ["javascript", /\bfunction\s+\w+\s*\((?!\s*\$)/, 2],
  ["javascript", /\b(document|window)\./, 3],
  ["python", /^\s*def\s+\w+\(.*\):\s*$/m, 6],
  ["python", /^\s*(elif|except)\b/m, 3],
  ["python", /\bin\s+range\(/, 4],
  ["python", /\b(None|True|False|self)\b/, 2],
  ["python", /^\s*(for|while|if)\b[^;{]*:\s*$/m, 3],
  ["python", /^\s*print\s*\(/m, 1],
  ["sql", /^\s*SELECT\b[\s\S]*\bFROM\b/im, 6],
  ["sql", /\b(CREATE\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)\b/i, 6],
  ["sql", /\bUPDATE\s+\w+\s+SET\b/i, 6],
  ["sql", /\bWHERE\b/, 1],
];

/** Guesses the language from telltale syntax; null when nothing scores clearly. */
export function detectLanguage(code: string): LanguageId | null {
  const scores = new Map<LanguageId, number>();
  for (const [language, pattern, weight] of SIGNS) {
    if (pattern.test(code)) scores.set(language, (scores.get(language) ?? 0) + weight);
  }
  let best: LanguageId | null = null;
  let bestScore = 0;
  for (const [language, score] of scores) {
    if (score > bestScore) [best, bestScore] = [language, score];
  }
  return bestScore >= 3 ? best : null;
}

/** Re-indents brace languages when the PDF text lost its indentation. */
function reindent(lines: string[], language: LanguageId | null) {
  if (lines.some((line) => /^\s+\S/.test(line)) || language === "python" || language === "sql") return lines;
  let depth = 0;
  return lines.map((raw) => {
    const line = raw.trim();
    const closesFirst = line.startsWith("}");
    if (closesFirst) depth = Math.max(0, depth - 1);
    const out = "    ".repeat(depth) + line;
    depth = Math.max(0, depth + (line.match(/{/g)?.length ?? 0) - (line.match(/}/g)?.length ?? 0) + (closesFirst ? 1 : 0));
    return out;
  });
}

const TYPOGRAPHY: [RegExp, string][] = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/[‐‑‒–—]/g, "-"],
  [/[  -  ]/g, " "],
  [/[​-‍﻿]/g, ""],
  [/⇒/g, "=>"],
  [/→/g, "->"],
  [/≠/g, "!="],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/…/g, "..."],
];

/** Swaps word-processor punctuation (smart quotes, dashes, ligature arrows) back to plain code characters. */
const plainCode = (line: string) => TYPOGRAPHY.reduce((text, [pattern, plain]) => text.replace(pattern, plain), line);

/** True when non-ASCII characters appear outside strings and comments, i.e. the PDF font didn't extract cleanly. */
function isGarbled(code: string) {
  const bare = code
    .replace(/(["'`])(?:\\.|(?!\1)[^\n])*\1/g, "")
    .replace(/(\/\/|#|--).*$/gm, "");
  return /[^\t\n\r\x20-\x7e]/.test(bare);
}

/** Finds runs of consecutive code-like lines on each page; skips runs the PDF font garbled. */
export function findCodeSnippets(pages: string[]): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  const seen = new Set<string>();
  pages.forEach((pageText, index) => {
    const lines = pageText.split("\n").map((line) => plainCode(line).replace(/\s+$/, ""));
    let run: string[] = [];
    const flush = () => {
      const body = run.filter((line) => line.trim());
      run = [];
      if (body.length < MIN_LINES || body.length > MAX_LINES || isGarbled(body.join("\n"))) return;
      const raw = body.join("\n");
      const language = detectLanguage(raw);
      const code = reindent(body, language).join("\n");
      const key = code.replace(/\s+/g, "");
      if (seen.has(key)) return;
      seen.add(key);
      snippets.push({ code, page: index + 1, language });
    };
    for (const line of lines) {
      if (isCodeLine(line)) run.push(line);
      else flush();
    }
    flush();
  });
  return snippets;
}

const KEYWORDS: Record<LanguageId, string[]> = {
  python: ["def", "return", "for", "while", "if", "elif", "else", "in", "import", "class", "print", "range", "len", "and", "or", "not", "True", "False", "None", "try", "except", "break", "continue", "input"],
  javascript: ["function", "return", "for", "while", "if", "else", "const", "let", "var", "new", "class", "console", "log", "true", "false", "null", "break", "continue", "of", "length", "push"],
  java: ["public", "private", "static", "void", "int", "double", "String", "boolean", "return", "for", "while", "if", "else", "new", "class", "System", "println", "true", "false", "null", "break", "continue", "length"],
  c: ["int", "char", "float", "double", "void", "return", "for", "while", "if", "else", "printf", "scanf", "include", "main", "break", "continue", "struct", "sizeof"],
  cpp: ["int", "char", "float", "double", "void", "return", "for", "while", "if", "else", "cout", "cin", "endl", "std", "using", "namespace", "string", "vector", "include", "main", "break", "continue"],
  php: ["echo", "function", "return", "foreach", "as", "for", "while", "if", "else", "array", "true", "false", "null", "class", "new", "public", "count"],
  sql: ["SELECT", "FROM", "WHERE", "ORDER", "BY", "GROUP", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "JOIN", "ON", "AND", "OR", "COUNT", "AS", "CREATE", "TABLE", "PRIMARY", "KEY", "DESC", "ASC", "LIMIT", "HAVING", "DISTINCT", "SUM", "AVG", "MAX", "MIN"],
};
const NOT_A_FUNCTION = new Set(["if", "for", "while", "switch", "catch", "return", "sizeof", "elif", "foreach", "and", "or", "not", "in", "VALUES", "IN", "ON", "AS"]);
const TYPES = "int|float|double|char|string|String|bool|boolean|long|short|auto|var|let|const|final|static";

interface Token {
  line: number;
  start: number;
  text: string;
}

/** Character ranges of string literals and comments, which are never blanked. */
function protectedRanges(line: string, language: LanguageId) {
  const ranges: [number, number][] = [];
  for (const m of line.matchAll(/(["'`])(?:\\.|(?!\1).)*\1/g)) ranges.push([m.index, m.index + m[0].length]);
  const comment = line.match(language === "python" ? /#.*$/ : language === "sql" ? /--.*$/ : /\/\/.*$/);
  if (comment?.index != null && !ranges.some(([a, b]) => comment.index! >= a && comment.index! < b)) ranges.push([comment.index, line.length]);
  if (language === "php") {
    const hash = line.match(/(?<![<?])#(?!include).*$/);
    if (hash?.index != null) ranges.push([hash.index, line.length]);
  }
  return ranges;
}

/** Every blankable token of the chosen kind, in reading order. */
function candidates(lines: string[], language: LanguageId, kind: BlankKind): Token[] {
  const tokens: Token[] = [];
  const keywords = new Set(KEYWORDS[language]);
  lines.forEach((line, lineIndex) => {
    if (/^\s*#\s*include\b/.test(line) && kind !== "keywords") return;
    const blocked = protectedRanges(line, language);
    const push = (text: string, start: number) => {
      if (blocked.some(([a, b]) => start < b && start + text.length > a)) return;
      tokens.push({ line: lineIndex, start, text });
    };
    if (kind === "keywords") {
      for (const m of line.matchAll(/[A-Za-z_]\w*/g)) if (keywords.has(m[0])) push(m[0], m.index);
    } else if (kind === "functions") {
      for (const m of line.matchAll(/(?<![\w$])([A-Za-z_]\w*)\s*\(/g)) if (!NOT_A_FUNCTION.has(m[1])) push(m[1], m.index);
    } else {
      const declared = new RegExp(`(?<=\\b(?:${TYPES})\\s+)\\$?[A-Za-z_]\\w*(?=\\s*(?:=|;|,|\\[))`, "g");
      for (const m of line.matchAll(declared)) push(m[0], m.index);
      const assigned = line.match(/^\s*(\$?[A-Za-z_]\w*)\s*(?:=(?!=)|\+=|-=|\*=|\/=)/);
      if (assigned) push(assigned[1], line.indexOf(assigned[1]));
      for (const m of line.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?)(?![\w.])/g)) push(m[1], m.index);
    }
  });
  return tokens;
}

/** Picks up to three distinct tokens spread across the snippet (first, middle, last). */
function pickBlanks(tokens: Token[]) {
  const distinct: Token[] = [];
  const texts = new Set<string>();
  for (const token of tokens) {
    if (texts.has(token.text)) continue;
    texts.add(token.text);
    distinct.push(token);
  }
  if (distinct.length <= MAX_BLANKS) return distinct;
  return [0, Math.floor((distinct.length - 1) / 2), distinct.length - 1].map((i) => distinct[i]);
}

/** A short name for the snippet: its first function or class name, else its first line. */
function snippetName(code: string) {
  const named = code.match(/\b(?:def|function|class)\s+([A-Za-z_]\w*)/) ?? code.match(new RegExp(`\\b(?:void|int|double|String|boolean|${TYPES})\\s+([A-Za-z_]\\w*)\\s*\\(`));
  if (named && named[1] !== "main") return named[1];
  const first = code.split("\n")[0].trim();
  return first.length > 40 ? `${first.slice(0, 40)}…` : first;
}

/** Turns code snippets into fill-in-the-blank exercise drafts. */
export function draftCodeExercises(pages: string[], kind: BlankKind, language: LanguageId | "auto"): CodeDraft[] {
  const meta = BLANK_KINDS.find((k) => k.id === kind)!;
  const drafts: CodeDraft[] = [];
  for (const snippet of findCodeSnippets(pages)) {
    const lang = language === "auto" ? snippet.language : language;
    if (!lang) continue;
    const lines = snippet.code.split("\n");
    const chosen = pickBlanks(candidates(lines, lang, kind));
    if (chosen.length === 0) continue;
    const ordered = [...chosen].sort((a, b) => a.line - b.line || a.start - b.start);
    const templateLines = [...lines];
    const blanks: Blank[] = [];
    [...ordered].reverse().forEach((token) => {
      const n = ordered.indexOf(token) + 1;
      const row = templateLines[token.line];
      templateLines[token.line] = row.slice(0, token.start) + `__${n}__` + row.slice(token.start + token.text.length);
      blanks.unshift({ n, answers: [token.text] });
    });
    drafts.push({
      key: `${snippet.page}:${drafts.length}:${kind}:${lang}`,
      page: snippet.page,
      language: lang,
      exerciseType: meta.exerciseType,
      title: `${languageInfo(lang).label}: ${snippetName(snippet.code)}`.slice(0, 200),
      template: templateLines.join("\n"),
      solution: snippet.code,
      blanks,
    });
    if (drafts.length >= MAX_DRAFTS) break;
  }
  return drafts;
}
