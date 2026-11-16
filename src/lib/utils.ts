import type { ProgressDay } from "@/lib/types";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rest}s`;
  return `${rest}s`;
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDate(iso: string, timeZone = "UTC", withTime = false) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export const formatPercent = (value: number) => `${Math.round(Number(value))}%`;

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function localDate(timeZone: string, date = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing isoDate. */
export function weekStart(isoDate: string) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -((day + 6) % 7));
}

const active = (day: ProgressDay | undefined) => Boolean(day && (day.items_answered > 0 || day.assessments_completed > 0));

export function summarizeProgress(days: ProgressDay[], today: string) {
  const byDate = new Map(days.map((d) => [d.activity_date, d]));

  let cursor = active(byDate.get(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (active(byDate.get(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const monday = weekStart(today);
  let weekAssessments = 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const day = byDate.get(date);
    weekAssessments += day?.assessments_completed ?? 0;
    return { date, items: day?.items_answered ?? 0, assessments: day?.assessments_completed ?? 0 };
  });

  const totals = days.reduce(
    (acc, d) => ({
      assessments: acc.assessments + d.assessments_completed,
      items: acc.items + d.items_answered,
      correct: acc.correct + d.items_correct,
      coding: acc.coding + d.coding_completed,
    }),
    { assessments: 0, items: 0, correct: 0, coding: 0 },
  );

  return { streak, studiedToday: active(byDate.get(today)), week, weekAssessments, totals, byDate };
}

/** Server clock for request-time rendering (sent to the client so timers ignore a wrong device clock). */
export const serverNow = () => Date.now();
