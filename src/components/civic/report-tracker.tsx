import { Check, RotateCcw, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@/generated/prisma/client";

function fmt(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Lifecycle stepper built only from real timestamps (STORY-013). Steps without a
// timestamp render as pending — never guessed. The first pending step is the
// "current stage" and is highlighted in the brand crimson.
export function ReportTracker({
  status,
  createdAt,
  verifiedAt,
  assignedAt,
  inProgressAt,
  resolvedAt,
  dueDate,
  officerName,
}: {
  status: IssueStatus;
  createdAt: Date | string;
  verifiedAt: Date | string | null;
  assignedAt: Date | string | null;
  inProgressAt: Date | string | null;
  resolvedAt: Date | string | null;
  dueDate: Date | string | null;
  officerName: string | null;
}) {
  const steps = [
    { key: "reported", label: "Reported", date: createdAt as Date | string | null, done: true },
    { key: "verified", label: "Verified by community", date: verifiedAt, done: verifiedAt != null },
    {
      key: "assigned",
      label: officerName ? `Assigned to ${officerName}` : "Assigned to an officer",
      date: assignedAt,
      done: assignedAt != null,
    },
    { key: "in_progress", label: "Work underway", date: inProgressAt, done: inProgressAt != null },
    { key: "resolved", label: "Resolved", date: resolvedAt, done: resolvedAt != null },
  ];

  const reopened = status === "REOPENED";
  // The current stage = first step not yet reached (unless everything's done).
  const activeIndex = reopened ? -1 : steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-5">
      <ol className="relative space-y-0">
        {steps.map((s, i) => {
          const isActive = i === activeIndex;
          const isLast = i === steps.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* connector line */}
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px",
                    s.done ? "bg-emerald-500/40" : "bg-border"
                  )}
                />
              )}
              {/* node */}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                  s.done
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-simrik text-white ring-4 ring-simrik/15"
                    : "border-2 border-border bg-background"
                )}
              >
                {s.done ? (
                  <Check className="size-3.5" />
                ) : isActive ? (
                  <span className="size-2 rounded-full bg-white" />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                )}
              </span>
              {/* label */}
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <p
                  className={cn(
                    "text-sm",
                    s.done ? "font-medium" : isActive ? "font-medium text-simrik" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </p>
                <span className="text-xs text-muted-foreground">
                  {s.date ? fmt(s.date) : isActive ? "In progress" : "Pending"}
                </span>
              </div>
            </li>
          );
        })}

        {reopened && (
          <li className="relative flex gap-3.5">
            <span className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-amber-500 text-white">
              <RotateCcw className="size-3.5" />
            </span>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Reopened — resolution disputed by the community
            </p>
          </li>
        )}
      </ol>

      {/* Committed completion — only if an official set one */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        {dueDate ? (
          <span>
            Committed completion: <span className="font-medium">{fmt(dueDate)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">No committed completion date yet.</span>
        )}
      </div>
    </div>
  );
}
