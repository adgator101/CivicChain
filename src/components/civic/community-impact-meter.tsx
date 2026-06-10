import { Users } from "lucide-react";
import { cn, impactConfidencePct } from "@/lib/utils";

export function CommunityImpactMeter({
  score,
  affectedCitizenCount,
  className,
  compact = false,
}: {
  score: number;
  affectedCitizenCount: number;
  className?: string;
  compact?: boolean;
}) {
  const pct = impactConfidencePct(score);
  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 80
      ? "bg-amber-500"
      : pct >= 60
      ? "bg-blue-500"
      : "bg-slate-400";

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Users className="size-3.5" />
        {affectedCitizenCount} affected · {pct}%
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Users className="size-4 text-muted-foreground" />
          {affectedCitizenCount} {affectedCitizenCount === 1 ? "citizen" : "citizens"} affected
        </span>
        <span className="tabular-nums font-semibold">{pct}% confidence</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}
