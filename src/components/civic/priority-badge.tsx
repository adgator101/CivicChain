import { Badge } from "@/components/ui/badge";
import { cn, priorityLabel } from "@/lib/utils";
import type { Priority } from "@/generated/prisma/client";

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <Badge className={cn("border-transparent", PRIORITY_STYLES[priority], className)}>
      {priorityLabel(priority)}
    </Badge>
  );
}
