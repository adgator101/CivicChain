import Link from "next/link";
import { ArrowUpRight, Award, ShieldCheck, Clock3, RotateCcw, CheckCircle2 } from "lucide-react";
import { categoryLabel, cn } from "@/lib/utils";
import { DEPARTMENT_LABELS } from "@/lib/departments";
import { officerRecognition } from "@/lib/recognition";
import type { MunicipalityAnalytics, EmployeePerformance } from "@/lib/queries";
import type { Category, Department } from "@/generated/prisma/client";

// Compact KPI + category breakdown for the HEAD dashboard left panel. Factual
// aggregates only — avg fix time, on-time rate, reopened count.
export function MunicipalityAnalyticsPanel({ data }: { data: MunicipalityAnalytics }) {
  const onTimePct = data.onTimeRate != null ? Math.round(data.onTimeRate * 100) : null;
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.count));

  const kpis = [
    {
      icon: <Clock3 className="size-3.5" />,
      value: data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : "—",
      label: "Avg fix time",
    },
    {
      icon: <CheckCircle2 className="size-3.5" />,
      value: onTimePct != null ? `${onTimePct}%` : "—",
      label: "On time",
    },
    {
      icon: <ShieldCheck className="size-3.5" />,
      value: String(data.resolved),
      label: "Resolved",
    },
    {
      icon: <RotateCcw className="size-3.5" />,
      value: String(data.reopened),
      label: "Reopened",
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">
        Municipality Insights
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-2.5">
            <p className="font-heading text-xl font-semibold leading-none tabular-nums">{k.value}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {k.icon}
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {data.byCategory.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Issues by category</p>
          {data.byCategory.slice(0, 6).map((c) => (
            <div key={c.category} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs">
                {categoryLabel(c.category as Category)}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-nilo/70"
                  style={{ width: `${Math.round((c.count / maxCat) * 100)}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.onTimeRate != null && (
        <p className="text-[11px] text-muted-foreground">
          On-time = resolved on or before the officer&apos;s committed date.
        </p>
      )}
    </section>
  );
}

export type TeamMember = {
  id: string;
  name: string;
  department: Department | null;
  perf: EmployeePerformance;
};

// Top performers in the municipality — links to each officer's public profile.
export function TeamPerformancePanel({ members }: { members: TeamMember[] }) {
  // Rank by resolved, then on-time rate. Only show those with any resolved work.
  const ranked = members
    .filter((m) => m.perf.resolved > 0)
    .sort(
      (a, b) =>
        b.perf.resolved - a.perf.resolved ||
        (b.perf.onTimeRate ?? 0) - (a.perf.onTimeRate ?? 0)
    )
    .slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">
          Team Performance
        </h2>
        <Link href="/authority/team" className="text-xs text-muted-foreground hover:text-foreground">
          Manage team
        </Link>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No resolved work yet. Officer stats appear here as issues get resolved.
        </p>
      ) : (
        <ul className="space-y-1">
          {ranked.map((m) => {
            const rec = officerRecognition(m.perf);
            const pct = m.perf.onTimeRate != null ? Math.round(m.perf.onTimeRate * 100) : null;
            return (
              <li key={m.id}>
                <Link
                  href={`/officers/${m.id}`}
                  className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      rec.tier === "trusted"
                        ? "bg-status-resolved/15 text-status-resolved"
                        : rec.tier === "reliable"
                        ? "bg-status-verified/15 text-status-verified"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {rec.tier === "trusted" ? (
                      <Award className="size-3.5" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-medium">
                      {m.name}
                      <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {m.department ? DEPARTMENT_LABELS[m.department] : "Officer"} ·{" "}
                      {m.perf.resolved} resolved
                      {pct != null ? ` · ${pct}% on time` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
