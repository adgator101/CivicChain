import { MapPin, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { IssueStatusBadge } from "@/components/civic/issue-status-badge";
import { PriorityBadge } from "@/components/civic/priority-badge";
import { categoryLabel, formatRelativeTime } from "@/lib/utils";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function CitizenProfilePage() {
  const user = await requireRole([Role.CITIZEN]);

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    include: {
      issue: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          category: true,
          updatedAt: true,
          affectedCitizenCount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const place = [
    user.municipalityName,
    user.wardNumber ? `Ward ${user.wardNumber}` : null,
    user.districtName,
    user.provinceName,
  ].filter(Boolean).join(" · ") || "No jurisdiction set";

  const resolvedCount = reports.filter((r) => r.issue?.status === "RESOLVED").length;
  const openCount = reports.filter((r) => r.issue && r.issue.status !== "RESOLVED").length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      {/* Identity card */}
      <section className="flex items-center gap-5">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-nilo text-xl font-semibold text-white">
          {initials(user.name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {place}
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 border-t border-b py-5">
        {[
          { label: "Reports submitted", value: reports.length },
          { label: "Open issues", value: openCount },
          { label: "Resolved", value: resolvedCount },
        ].map((s) => (
          <div key={s.label} className="space-y-1 text-center">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground leading-snug">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Reported issues */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <FileText className="size-5 text-muted-foreground" />
          My reported issues
        </h2>
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">You haven&apos;t submitted any reports yet.</p>
            <Link href="/report" className="mt-2 inline-block text-sm font-medium text-simrik underline underline-offset-4">
              Report your first issue →
            </Link>
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {reports.map((report) => (
              <div key={report.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  {report.issue ? (
                    <Link
                      href={`/issues/${report.issue.id}`}
                      className="font-medium leading-snug hover:underline underline-offset-4"
                    >
                      {report.issue.title}
                    </Link>
                  ) : (
                    <p className="font-medium leading-snug text-muted-foreground">{report.title}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {report.issue ? categoryLabel(report.issue.category) : "Pending"} ·{" "}
                    {formatRelativeTime(new Date(report.createdAt))}
                    {report.issue?.affectedCitizenCount && report.issue.affectedCitizenCount > 1
                      ? ` · ${report.issue.affectedCitizenCount} citizens affected`
                      : ""}
                  </p>
                </div>
                {report.issue && (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <IssueStatusBadge status={report.issue.status} />
                    <PriorityBadge priority={report.issue.priority} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
