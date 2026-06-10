import { Clock, AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, needsAttention, commitmentState } from "@/lib/utils";
import { IssueStatus } from "@/generated/prisma/enums";

// Honest, factual age indicator. Shows how long an issue has sat in its current
// status ("Open 12d", "Unassigned 5d"), highlights when it crosses a plain
// attention threshold, and surfaces a passed HEAD commitment — never an invented
// SLA or "overdue" against a fabricated deadline.
export function AttentionBadge({
  status,
  updatedAt,
  dueDate,
  className,
}: {
  status: IssueStatus;
  updatedAt: Date | string;
  dueDate?: Date | string | null;
  className?: string;
}) {
  // Resolved issues are not "waiting" on anyone.
  if (status === IssueStatus.RESOLVED) return null;

  const { flagged, daysInStatus, reason, limit } = needsAttention(status, updatedAt);
  const commitment = commitmentState(dueDate ?? null);

  // Severity: muted within threshold, amber past it, red at well past (2× limit).
  const tone = !flagged
    ? "border-transparent bg-muted text-muted-foreground"
    : daysInStatus > limit * 2
    ? "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
    : "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <Badge className={tone}>
        {flagged ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
        {reason} {daysInStatus}d
      </Badge>
      {commitment.passed && (
        <Badge className="border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          <CalendarClock className="size-3" />
          Commitment {commitment.daysPast}d ago
        </Badge>
      )}
    </span>
  );
}
