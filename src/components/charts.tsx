// Small dependency-free charts. All server-renderable.
import { addDays, cn, weekStart } from "@/lib/utils";
import type { ProgressDay } from "@/lib/types";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Questions answered per day for the current week. */
export function WeekBars({ week, today }: { week: { date: string; items: number }[]; today: string }) {
  const max = Math.max(1, ...week.map((d) => d.items));
  return (
    <div className="flex h-28 items-end gap-2" role="img" aria-label="Questions answered each day this week">
      {week.map((day, index) => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${day.date}: ${day.items} answered`}>
          <span className="text-[11px] tabular-nums text-fg-subtle">{day.items || ""}</span>
          <div className="flex h-16 w-full items-end rounded-md bg-muted">
            <div
              className={cn("w-full rounded-md", day.date === today ? "bg-brand" : "bg-brand/45")}
              style={{ height: `${day.items === 0 ? 0 : Math.max(8, (day.items / max) * 100)}%` }}
            />
          </div>
          <span className={cn("text-[11px]", day.date === today ? "font-semibold text-fg" : "text-fg-subtle")}>{DAY_LABELS[index]}</span>
        </div>
      ))}
    </div>
  );
}

/** GitHub-style grid of study activity for the last `weeks` weeks. */
export function ActivityGrid({ byDate, today, weeks = 14 }: { byDate: Map<string, ProgressDay>; today: string; weeks?: number }) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const level = (items: number) => (items === 0 ? "bg-muted" : items < 5 ? "bg-brand/30" : items < 15 ? "bg-brand/60" : "bg-brand");
  return (
    <div className="flex gap-1" role="img" aria-label={`Study activity for the last ${weeks} weeks`}>
      {Array.from({ length: weeks }, (_, w) => (
        <div key={w} className="flex flex-1 flex-col gap-1">
          {Array.from({ length: 7 }, (_, d) => {
            const date = addDays(start, w * 7 + d);
            const items = byDate.get(date)?.items_answered ?? 0;
            return (
              <div
                key={date}
                title={`${date}: ${items} answered`}
                className={cn("aspect-square w-full max-w-4 rounded-[3px]", date > today ? "opacity-0" : level(items))}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Score line across attempts, oldest → newest. */
export function ScoreTrend({ scores, className }: { scores: number[]; className?: string }) {
  if (scores.length < 2) {
    return <p className="text-sm text-fg-subtle">Complete two assessments to see your trend.</p>;
  }
  const w = 600;
  const h = 140;
  const pad = 8;
  const x = (i: number) => pad + (i / (scores.length - 1)) * (w - pad * 2);
  const y = (score: number) => pad + (1 - score / 100) * (h - pad * 2);
  const points = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} role="img" aria-label="Score trend across recent assessments" preserveAspectRatio="none">
      {[0, 50, 100].map((mark) => (
        <line key={mark} x1={pad} x2={w - pad} y1={y(mark)} y2={y(mark)} stroke="var(--border)" strokeDasharray={mark === 50 ? "4 4" : undefined} />
      ))}
      <polygon points={`${x(0)},${y(0)} ${points} ${x(scores.length - 1)},${y(0)}`} fill="var(--brand)" opacity="0.08" />
      <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ScoreRing({ percent, size = 132 }: { percent: number; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const color = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--amber)" : "var(--danger)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}
