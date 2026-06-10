import { Badge } from "@/components/ui/badge";
import { cn, statusLabel } from "@/lib/utils";
import type { IssueStatus } from "@/generated/prisma/client";

const STATUS_STYLES: Record<IssueStatus, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  VERIFIED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ASSIGNED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REOPENED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function IssueStatusBadge({
  status,
  className,
}: {
  status: IssueStatus;
  className?: string;
}) {
  return (
    <Badge className={cn("border-transparent", STATUS_STYLES[status], className)}>
      {statusLabel(status)}
    </Badge>
  );
}
