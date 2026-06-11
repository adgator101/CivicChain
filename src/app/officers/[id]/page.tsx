import { notFound } from "next/navigation";
import { Award, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Role } from "@/generated/prisma/client";
import { getEmployeePerformance } from "@/lib/queries";
import { officerRecognition, onTimeSummary } from "@/lib/recognition";
import { DEPARTMENT_LABELS } from "@/lib/departments";
import { TopNav } from "@/components/layout/top-nav";
import { Card } from "@/components/ui/card";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

const TIER_STYLE: Record<string, string> = {
  trusted: "bg-status-resolved/15 text-status-resolved",
  reliable: "bg-status-verified/15 text-status-verified",
  new: "bg-muted text-muted-foreground",
};

// PUBLIC officer profile — positive/neutral recognition only. No operational
// internals (oldest-open, past-threshold, reopen counts) are shown here.
export default async function OfficerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [viewer, officer, recentResolved] = await Promise.all([
    getCurrentUser(),
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        wardNumber: true,
        municipalityName: true,
        districtName: true,
      },
    }),
    prisma.issue.findMany({
      where: { assignedToId: id, status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 5,
      select: { id: true, title: true, wardNumber: true, resolvedAt: true },
    }),
  ]);

  if (!officer || officer.role !== Role.LOCAL_BODY_EMPLOYEE) notFound();

  const perf = (await getEmployeePerformance({ assignedToId: id }))[id] ?? {
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

  const rec = officerRecognition(perf);
  const timely = onTimeSummary(perf);
  const place = [
    officer.wardNumber ? `Ward ${officer.wardNumber}` : null,
    officer.municipalityName,
    officer.districtName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={viewer ?? undefined} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        {/* Hero */}
        <header className="pennant-clip bg-nilo px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-white/10 font-heading text-xl font-semibold">
              {initials(officer.name)}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {officer.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
                {officer.department ? DEPARTMENT_LABELS[officer.department] : "Local body officer"}
                {place && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {place}
                  </span>
                )}
              </p>
            </div>
          </div>
        </header>

        {/* Recognition */}
        <Card className="flex items-center gap-4 p-5">
          <span className={`grid size-12 shrink-0 place-items-center rounded-full ${TIER_STYLE[rec.tier]}`}>
            {rec.tier === "trusted" ? (
              <Award className="size-6" />
            ) : rec.tier === "reliable" ? (
              <ShieldCheck className="size-6" />
            ) : (
              <CheckCircle2 className="size-6" />
            )}
          </span>
          <div>
            <p className="font-heading text-lg font-semibold">{rec.label}</p>
            <p className="text-sm text-muted-foreground">{rec.blurb}</p>
          </div>
        </Card>

        {/* Factual public stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="font-heading text-3xl font-semibold tabular-nums">{perf.resolved}</p>
            <p className="mt-1 text-xs text-muted-foreground">Issues resolved</p>
          </Card>
          {timely && (
            <Card className="p-4">
              <p className="font-heading text-3xl font-semibold tabular-nums">
                {perf.onTime}
                <span className="text-base text-muted-foreground">/{perf.committedResolved}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Finished on time</p>
            </Card>
          )}
          {perf.avgResolutionDays != null && (
            <Card className="p-4">
              <p className="font-heading text-3xl font-semibold tabular-nums">
                {perf.avgResolutionDays}
                <span className="text-base text-muted-foreground">d</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Typical time to fix</p>
            </Card>
          )}
        </div>

        {timely && (
          <p className="text-sm text-muted-foreground">
            {officer.name.split(" ")[0]} {timely.toLowerCase()} — measured against the completion
            dates they committed to.
          </p>
        )}

        {/* Recent resolved work */}
        {recentResolved.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">
              Recently resolved
            </h2>
            <Card className="divide-y p-0">
              {recentResolved.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3">
                  <CheckCircle2 className="size-4 shrink-0 text-status-resolved" />
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.wardNumber ? `Ward ${r.wardNumber}` : ""}
                    {r.resolvedAt
                      ? ` · ${new Date(r.resolvedAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}`
                      : ""}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Recognition reflects this officer&apos;s real, recorded work on CivicChain. It is based
          on factual outcomes, not opinions or ratings.
        </p>
      </main>
    </div>
  );
}
