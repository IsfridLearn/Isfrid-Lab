// List rows shared by the dashboard, subject pages, study sets and history.
import Link from "next/link";
import { ChevronRight, FileText, ListChecks, PenLine, Terminal } from "lucide-react";
import { Badge, scoreTone } from "@/components/ui";
import { modeLabel } from "@/lib/languages";
import { formatBytes, formatDate, formatDuration, formatPercent } from "@/lib/utils";
import type { Attempt, DocumentRow, StudyMode, StudySet } from "@/lib/types";

export function ModeIcon({ mode, className }: { mode: StudyMode; className?: string }) {
  const Icon = mode === "coding" ? Terminal : mode === "identification" ? PenLine : ListChecks;
  return <Icon className={className ?? "size-4"} />;
}

const rowClass = "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60";

export function RowList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</div>;
}

export function SetRow({ set, subjectName, count }: { set: StudySet; subjectName?: string; count?: number }) {
  return (
    <Link href={`/sets/${set.id}`} className={rowClass}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-fg-muted">
        <ModeIcon mode={set.mode} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{set.title}</span>
        <span className="block truncate text-xs text-fg-subtle">
          {modeLabel(set.mode)}
          {subjectName ? ` · ${subjectName}` : ""}
          {count != null ? ` · ${count} ${count === 1 ? "item" : "items"}` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 text-fg-subtle" />
    </Link>
  );
}

export function DocumentRowLink({ doc, subjectName, timeZone }: { doc: DocumentRow; subjectName?: string; timeZone: string }) {
  return (
    <Link href={`/library/${doc.id}`} className={rowClass}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-fg-muted">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{doc.title}</span>
        <span className="block truncate text-xs text-fg-subtle">
          {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} · {formatBytes(doc.size_bytes)}
          {subjectName ? ` · ${subjectName}` : ""} · {formatDate(doc.created_at, timeZone)}
        </span>
      </span>
      <ChevronRight className="size-4 text-fg-subtle" />
    </Link>
  );
}

export function AttemptRow({ attempt, timeZone }: { attempt: Attempt; timeZone: string }) {
  const score = Number(attempt.score_percent);
  return (
    <Link href={`/results/${attempt.id}`} className={rowClass}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-fg-muted">
        <ModeIcon mode={attempt.mode} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attempt.set_title}</span>
        <span className="block truncate text-xs text-fg-subtle">
          {attempt.completed_at ? formatDate(attempt.completed_at, timeZone, true) : ""} · {attempt.correct_count}/{attempt.item_count} correct ·{" "}
          {formatDuration(attempt.duration_seconds)}
          {attempt.time_limit_seconds ? " · timed" : ""}
        </span>
      </span>
      <Badge tone={scoreTone(score)} className="tabular-nums">
        {formatPercent(score)}
      </Badge>
    </Link>
  );
}
