import { ShieldCheck, MapPin } from "lucide-react";
import { requireRole } from "@/lib/session";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/civic/priority-badge";
import { CommunityImpactMeter } from "@/components/civic/community-impact-meter";
import { VerifyIssueButtons } from "@/components/civic/verify-issue-buttons";
import { categoryLabel } from "@/lib/utils";

export default async function VerifyQueuePage() {
  const user = await requireRole([Role.CITIZEN]);

  // Issues in the citizen's municipality still awaiting community verification.
  const issues = await prisma.issue.findMany({
    where: {
      status: "SUBMITTED",
      municipalityName: user.municipalityName ?? undefined,
    },
    orderBy: [{ communityImpactScore: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      priority: true,
      wardNumber: true,
      communityImpactScore: true,
      affectedCitizenCount: true,
      confirmCount: true,
      disputeCount: true,
    },
  });

  // Ward-first ordering: issues in the citizen's own ward float to the top.
  const ordered = [...issues].sort((a, b) => {
    const aLocal = a.wardNumber === user.wardNumber ? 0 : 1;
    const bLocal = b.wardNumber === user.wardNumber ? 0 : 1;
    return aLocal - bLocal;
  });

  const myVotes = await prisma.issueVerification.findMany({
    where: { userId: user.id, issueId: { in: ordered.map((i) => i.id) } },
    select: { issueId: true, type: true },
  });
  const voteByIssue = new Map(myVotes.map((v) => [v.issueId, v.type] as const));

  return (
    <div className="space-y-6">
      <div className="space-y-1 border-b pb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="size-6 text-primary" />
          Verify issues near you
        </h1>
        <p className="text-sm text-muted-foreground">
          These reports are awaiting community verification. Confirmations from your ward and
          ones with a geotagged photo count for more.
        </p>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing awaiting verification in {user.municipalityName ?? "your area"} right now.
        </p>
      ) : (
        <div className="space-y-4">
          {ordered.map((issue) => (
            <Card key={issue.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-snug">{issue.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {issue.wardNumber ? `Ward ${issue.wardNumber} · ` : ""}
                    {categoryLabel(issue.category)}
                    {issue.wardNumber === user.wardNumber ? " · in your ward" : ""}
                  </p>
                </div>
                <PriorityBadge priority={issue.priority} />
              </div>

              {issue.description && (
                <p className="line-clamp-2 text-sm text-foreground/90">{issue.description}</p>
              )}

              <CommunityImpactMeter
                score={issue.communityImpactScore}
                affectedCitizenCount={issue.affectedCitizenCount}
              />

              <VerifyIssueButtons
                issueId={issue.id}
                initialConfirmCount={issue.confirmCount}
                initialDisputeCount={issue.disputeCount}
                myVerification={voteByIssue.get(issue.id) ?? null}
                issueStatus={issue.status}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
