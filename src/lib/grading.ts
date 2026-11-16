// Deterministic answer checking: pure functions used for all grading.
import type { Blank, CheckResult, SubmissionResult } from "@/lib/types";

/** Identification answers: ignore case, accents-compatible forms and extra spaces. */
export function normalizeAnswer(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function gradeIdentification(response: string, accepted: string[]) {
  const given = normalizeAnswer(response);
  return given.length > 0 && accepted.some((a) => normalizeAnswer(a) === given);
}

/** Correct only when the chosen options are exactly the correct options. */
export function gradeMultipleChoice(selected: string[], correctIds: string[]) {
  if (selected.length === 0 || selected.length !== correctIds.length) return false;
  const chosen = new Set(selected);
  return correctIds.every((id) => chosen.has(id));
}

/** Code comparison: case-sensitive, but spacing around punctuation never matters. */
export function normalizeCode(code: string) {
  return code
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s*([^\w\s])\s*/g, "$1")
    .trim();
}

/** Program output comparison: ignore trailing spaces per line and trailing blank lines. */
export function normalizeOutput(output: string) {
  return output
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export const outputsMatch = (actual: string, expected: string) =>
  normalizeOutput(actual) === normalizeOutput(expected);

export const BLANK_PATTERN = /__(\d+)__/g;

/** The blank numbers used in a template, in order of first appearance. */
export function blankNumbers(template: string) {
  const seen: number[] = [];
  for (const match of template.matchAll(BLANK_PATTERN)) {
    const n = Number(match[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

/** Replace every blank with its first accepted answer (used to build a runnable solution). */
export function fillBlanks(template: string, blanks: Blank[]) {
  return template.replace(BLANK_PATTERN, (marker, n) => {
    const blank = blanks.find((b) => b.n === Number(n));
    return blank?.answers[0] ?? marker;
  });
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Extracts what the student typed into each blank; null when code outside the blanks was changed. */
export function extractBlankValues(template: string, code: string): { n: number; value: string }[] | null {
  const parts = template.split(/__(\d+)__/);
  const order: number[] = [];
  let pattern = "^\\s*";
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      order.push(Number(part));
      pattern += "([\\s\\S]*?)";
    } else {
      const tokens = part.split(/\s+/).filter(Boolean).map(escapeRegex);
      if (tokens.length) pattern += "\\s*" + tokens.join("\\s*") + "\\s*";
    }
  });
  pattern += "\\s*$";
  const match = new RegExp(pattern).exec(code);
  if (!match) return null;
  return order.map((n, i) => ({ n, value: match[i + 1].trim() }));
}

export function gradeBlanks(template: string, blanks: Blank[], code: string): SubmissionResult {
  const numbers = blankNumbers(template);
  const values = extractBlankValues(template, code);
  if (!values) {
    return {
      status: "failed",
      score: 0,
      passed: 0,
      total: numbers.length,
      checks: [],
      message:
        "The code outside the blanks was changed, so the blanks can't be checked. Reset the editor and replace only the __1__, __2__ … markers.",
    };
  }
  const checks: CheckResult[] = numbers.map((n) => {
    const accepted = (blanks.find((b) => b.n === n)?.answers ?? []).map(normalizeCode);
    const given = values.filter((v) => v.n === n).map((v) => v.value);
    const unfilled = given.some((v) => v === "" || /^__\d+__$/.test(v));
    const passed = !unfilled && accepted.length > 0 && given.every((v) => accepted.includes(normalizeCode(v)));
    return { label: `Blank ${n}`, passed, actual: unfilled ? "(left blank)" : given.join("  |  ") };
  });
  return summarize(checks);
}

export function gradeOutputPrediction(response: string, expected: string): SubmissionResult {
  const passed = response.trim().length > 0 && outputsMatch(response, expected);
  return summarize([{ label: "Predicted output", passed, actual: response, expected }]);
}

export function gradeSolutionMatch(code: string, solution: string): SubmissionResult {
  const passed = normalizeCode(code) === normalizeCode(solution);
  return {
    ...summarize([{ label: "Matches the reference solution", passed }]),
    message: passed
      ? undefined
      : "Your code doesn't match the reference solution yet. This exercise is checked by comparing code, not by running it.",
  };
}

export function summarize(checks: CheckResult[], message?: string): SubmissionResult {
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const score = total === 0 ? 0 : passed / total;
  return {
    status: total > 0 && passed === total ? "passed" : passed > 0 ? "partial" : "failed",
    score,
    passed,
    total,
    checks,
    message,
  };
}
