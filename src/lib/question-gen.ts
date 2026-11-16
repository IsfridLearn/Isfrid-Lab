// Rule-based question drafting: finds definition sentences in PDF text and turns them into questions.

export interface Definition {
  term: string;
  definition: string;
  sentence: string;
  page: number;
  glossary: boolean;
}

export interface DraftQuestion {
  key: string;
  term: string;
  page: number;
  prompt: string;
  accepted?: string[];
  options?: { body: string; is_correct: boolean }[];
}

const BLANK = "________";
const MAX_DRAFTS = 50;
const NOT_A_TERM =
  /^(it|this|that|these|those|they|there|here|he|she|we|you|i|which|what|who|when|where|why|how|each|every|some|all|one|such|its|their|our|your|his|her|figure|fig|table|chapter|section|page|example|lesson|module|unit|activity|exercise|question|answer|note|step|part|the|a|an)$/i;
const TERM_WORD = /^[\p{L}\p{N}][\p{L}\p{N}+#.'/()-]*$/u;

const FORWARD = [
  /^(?:(?:a|an|the)\s+)?(.{1,60}?)\s+(?:is|are)\s+(?:defined as\s+)?((?:a|an|the)\s+.+)$/i,
  /^(?:(?:a|an|the)\s+)?(.{1,60}?)\s+(?:refers? to|(?:is|are) defined as|means|(?:is|are) known as|stands for)\s+(.+)$/i,
];
const REVERSE = /^(.+?)\s+(?:is|are)\s+(?:called|known as|termed|referred to as)\s+(?:(?:a|an|the)\s+)?(.{1,60}?)$/i;
const GLOSSARY = /^([\p{Lu}\p{N}][^:–—]{0,58}?)\s*(?::|\s[–—-])\s+(.{15,})$/u;

/** Accepts 1–5 word noun phrases that can stand alone as an answer. */
function cleanTerm(raw: string) {
  const term = raw.trim().replace(/^["'“‘(]+|["'”’),;]+$/g, "");
  const words = term.split(/\s+/);
  if (!term || term.length > 50 || words.length > 5) return null;
  if (NOT_A_TERM.test(words[0]) || /^\d+$/.test(term)) return null;
  if (!words.every((word) => TERM_WORD.test(word))) return null;
  return term;
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ").replace(/[.;:,\s]+$/, "");
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const capitalize = (text: string) => (/^[a-z]/.test(text) ? text[0].toUpperCase() + text.slice(1) : text);

/** Replaces every occurrence of the term (as a whole word) with a blank. */
function blankOut(text: string, term: string, blank = BLANK) {
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, "giu"), blank);
}

/** Splits page text into sentences and single lines, remembering the page number. */
function units(pages: string[]) {
  const sentences: { text: string; page: number }[] = [];
  const lines: { text: string; page: number }[] = [];
  pages.forEach((pageText, index) => {
    const page = index + 1;
    const text = pageText.replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2");
    const rows = text.split("\n").map((line) => line.trim()).filter(Boolean);
    for (const row of rows) lines.push({ text: row, page });
    const flat = rows
      .map((row, i) => (row.length < 40 && !/[.!?:,;]$/.test(row) && /^\p{Lu}/u.test(rows[i + 1] ?? "") ? `${row}.` : row))
      .join(" ");
    for (const sentence of flat.split(/(?<=[.!?])\s+(?=["“(]?[\p{Lu}\p{N}])/u)) {
      if (sentence.length >= 25 && sentence.length <= 400) sentences.push({ text: sentence.trim(), page });
    }
  });
  return { sentences, lines };
}

/** Finds "X is a …", "X refers to …", "… is called X" and glossary-style "X: …" definitions. */
export function findDefinitions(pages: string[]): Definition[] {
  const found: Definition[] = [];
  const seen = new Set<string>();
  const add = (rawTerm: string, rawDefinition: string, sentence: string, page: number, glossary: boolean) => {
    const term = cleanTerm(rawTerm);
    const definition = tidy(rawDefinition);
    if (!term || definition.length < 15 || definition.length > 300) return;
    const key = term.toLowerCase();
    if (seen.has(key) || blankOut(definition, term) === BLANK) return;
    seen.add(key);
    found.push({ term, definition, sentence: tidy(sentence), page, glossary });
  };

  const { sentences, lines } = units(pages);
  for (const { text, page } of sentences) {
    const body = text.replace(/[.!?]+$/, "");
    const forward = FORWARD.map((pattern) => pattern.exec(body)).find(Boolean);
    if (forward) {
      add(forward[1], forward[2], text, page, false);
      continue;
    }
    const reverse = REVERSE.exec(body);
    if (reverse) add(reverse[2], reverse[1], text, page, false);
  }
  for (const { text, page } of lines) {
    const match = GLOSSARY.exec(text);
    if (match && match[1].split(/\s+/).length <= 5) add(match[1], match[2], text, page, true);
  }
  return found.sort((a, b) => a.page - b.page);
}

/** Small stable hash so the same PDF always produces the same choice order. */
function hash(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Picks up to `count` other terms as wrong choices, preferring ones of similar length. */
function distractors(target: Definition, all: Definition[], count: number) {
  const words = target.term.split(/\s+/).length;
  return all
    .filter((d) => d.term.toLowerCase() !== target.term.toLowerCase())
    .map((d) => ({ term: d.term, score: Math.abs(d.term.split(/\s+/).length - words) * 1000 + (hash(target.term + d.term) % 1000) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((d) => d.term);
}

/** Turns definitions into identification or multiple-choice drafts for the student to review. */
export function draftQuestions(pages: string[], mode: "multiple_choice" | "identification"): DraftQuestion[] {
  const definitions = findDefinitions(pages);
  const drafts: DraftQuestion[] = [];
  for (const def of definitions.slice(0, MAX_DRAFTS)) {
    const key = `${def.page}:${def.term.toLowerCase()}`;
    if (mode === "identification") {
      const prompt = def.glossary ? `Identify the term: ${blankOut(def.definition, def.term)}.` : `${blankOut(def.sentence, def.term)}.`;
      drafts.push({ key, term: def.term, page: def.page, prompt, accepted: [def.term] });
      continue;
    }
    const wrong = distractors(def, definitions, 3);
    if (wrong.length === 0) continue;
    const choices = [def.term, ...wrong].map(capitalize);
    const correctAt = hash(def.term) % choices.length;
    [choices[0], choices[correctAt]] = [choices[correctAt], choices[0]];
    drafts.push({
      key,
      term: def.term,
      page: def.page,
      prompt: `Which term matches this description? ${capitalize(blankOut(def.definition, def.term, "____"))}.`,
      options: choices.map((body, index) => ({ body, is_correct: index === correctAt })),
    });
  }
  return drafts;
}
