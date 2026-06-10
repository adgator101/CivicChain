import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, computeEscalation } from "@/lib/utils";
import type { IssueStatus, Priority } from "@/generated/prisma/client";

export function EscalationBadge({
  status,
  priority,
  updatedAt,
  dueDate,
  className,
}: {
  status: IssueStatus;
  priority: Priority;
  updatedAt: Date | string;
  dueDate: Date | string | null;
  className?: string;
}) {
  const esc = computeEscalation(
    status,
    priority,
    new Date(updatedAt),
    dueDate ? new Date(dueDate) : null
  );

  if (!esc.isEscalated) return null;

  const days = Math.floor(esc.hoursOverdue / 24);
  const label =
    days >= 1
      ? `${days}d overdue`
      : `${esc.hoursOverdue}h overdue`;

  return (
    <Badge
      className={cn(
        "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        className
      )}
    >
      <AlertTriangle className="size-3" />
      {label}
    </Badge>
  );
}
