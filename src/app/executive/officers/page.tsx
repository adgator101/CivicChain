import Link from "next/link";
import { Users2, ChevronRight, ArrowUpRight } from "lucide-react";
import { requireRole } from "@/lib/session";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmployeePerformance, type EmployeePerformance } from "@/lib/queries";
import { officerRecognition } from "@/lib/recognition";
import { Card } from "@/components/ui/card";
import { DepartmentBadge } from "@/components/civic/department-badge";

type Officer = {
  id: string;
  name: string;
  department: import("@/generated/prisma/client").Department | null;
  wardNumber: number | null;
  municipalityName: string | null;
};

const EMPTY: EmployeePerformance = {
  open: 0,
  resolved: 0,
  avgResolutionDays: null,
  oldestOpenDays: null,
  pastThreshold: 0,
  committedResolved: 0,
  onTime: 0,
  onTimeRate: null,
  reopened: 0,
};

function OfficerRow({ o, perf }: { o: Officer; perf: EmployeePerformance }) {
  const rec = officerRecognition(perf);
  const pct = perf.onTimeRate != null ? Math.round(perf.onTimeRate * 100) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <Link
        href={`/officers/${o.id}`}
        className="group min-w-0 flex-1 inline-flex items-center gap-1.5"
      >
        <span className="truncate font-medium group-hover:underline">{o.name}</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>

      {o.department ? (
        <DepartmentBadge department={o.department} />
      ) : (
        <span className="text-xs text-muted-foreground">No section</span>
      )}

      {rec.tier !== "new" && (
        <span
          className={
            rec.tier === "trusted"
              ? "rounded-full bg-status-resolved/10 px-2 py-0.5 text-xs font-medium text-status-resolved"
              : "rounded-full bg-status-verified/10 px-2 py-0.5 text-xs font-medium text-status-verified"
          }
        >
          {rec.label}
        </span>
      )}

      <div className="flex shrink-0 gap-4 text-sm tabular-nums">
        <span className="text-muted-foreground">
          On time{" "}
          <span className="font-medium text-foreground">
            {perf.committedResolved > 0 ? `${perf.onTime}/${perf.committedResolved}` : "—"}
            {pct != null ? ` (${pct}%)` : ""}
          </span>
        </span>
        <span className="text-muted-foreground">
          Resolved <span className="font-medium text-foreground">{perf.resolved}</span>
        </span>
        <span className="text-muted-foreground">
          Avg{" "}
          <span className="font-medium text-foreground">
            {perf.avgResolutionDays != null ? `${perf.avgResolutionDays}d` : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          Open <span className="font-medium text-foreground">{perf.open}</span>
        </span>
        {perf.reopened > 0 && (
          <span className="text-simrik">Reopened {perf.reopened}</span>
        )}
      </div>
    </div>
  );
}

export default async function ExecutiveOfficersPage() {
  await requireRole([Role.EXECUTIVE_BODY]);

  const [officers, perf] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.LOCAL_BODY_EMPLOYEE, isActive: true },
      select: {
        id: true,
        name: true,
        department: true,
        wardNumber: true,
        municipalityName: true,
      },
      orderBy: { name: "asc" },
    }),
    getEmployeePerformance({}),
  ]);

  // Group by municipality.
  const byMuni = new Map<string, Officer[]>();
  for (const o of officers) {
    const key = o.municipalityName ?? "Unassigned";
    const list = byMuni.get(key) ?? [];
    list.push(o);
    byMuni.set(key, list);
  }
  const groups = [...byMuni.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="w-full space-y-6">
      <div className="border-b-2 border-nilo/15 pb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Officers</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Users2 className="size-4 shrink-0" />
          {officers.length} active {officers.length === 1 ? "officer" : "officers"} nationwide ·
          recognition from real, recorded outcomes
        </p>
      </div>

      {officers.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-muted-foreground">
          No officers on the platform yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([muni, list]) => (
            <details key={muni} open className="group overflow-hidden rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="font-heading text-base font-semibold">{muni}</span>
                <span className="text-sm text-muted-foreground">
                  {list.length} {list.length === 1 ? "officer" : "officers"}
                </span>
              </summary>
              <div className="divide-y border-t">
                {list.map((o) => (
                  <OfficerRow key={o.id} o={o} perf={perf[o.id] ?? EMPTY} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
