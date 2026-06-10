import { prisma } from "@/lib/prisma";
import { computeEscalation } from "@/lib/utils";
import { IssueStatus, Prisma, Role } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/session";

export const OPEN_STATUSES: IssueStatus[] = [
  IssueStatus.SUBMITTED,
  IssueStatus.VERIFIED,
  IssueStatus.ASSIGNED,
  IssueStatus.IN_PROGRESS,
  IssueStatus.REOPENED,
];

// Restrict a query to what a user is allowed to see.
// EXECUTIVE_BODY → no restriction (national). LOCAL_BODY_* → their municipality.
export function scopeForUser(user: CurrentUser | null): Prisma.IssueWhereInput {
  if (!user) return {};
  if (user.role === Role.LOCAL_BODY_EMPLOYEE || user.role === Role.LOCAL_BODY_HEAD) {
    return user.municipalityName ? { municipalityName: user.municipalityName } : {};
  }
  return {};
}

export async function getDashboardStats(where: Prisma.IssueWhereInput) {
  const grouped = await prisma.issue.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const byStatus: Record<string, number> = {
    SUBMITTED: 0,
    VERIFIED: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    REOPENED: 0,
  };
  for (const g of grouped) byStatus[g.status] = g._count._all;

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const open = total - byStatus.RESOLVED;

  const escalated = await getEscalatedIssues(where);

  return {
    total,
    open,
    byStatus,
    escalatedCount: escalated.length,
    resolved: byStatus.RESOLVED,
  };
}

export type EscalatedIssue = Awaited<ReturnType<typeof getEscalatedIssues>>[number];

export async function getEscalatedIssues(where: Prisma.IssueWhereInput) {
  const issues = await prisma.issue.findMany({
    where: { ...where, status: { in: OPEN_STATUSES } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      municipalityName: true,
      wardNumber: true,
      category: true,
      reportCount: true,
      communityImpactScore: true,
      affectedCitizenCount: true,
      updatedAt: true,
      createdAt: true,
      dueDate: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });

  return issues
    .map((i) => ({
      ...i,
      escalation: computeEscalation(i.status, i.priority, i.updatedAt, i.dueDate),
    }))
    .filter((i) => i.escalation.isEscalated)
    .sort((a, b) => b.escalation.hoursOverdue - a.escalation.hoursOverdue);
}

// Issues carrying an AI root-cause suggestion above the 0.65 confidence
// threshold that have not yet been folded into a Root Issue.
export async function getRootCauseSuggestions(where: Prisma.IssueWhereInput) {
  return prisma.issue.findMany({
    where: {
      ...where,
      rootIssueId: null,
      aiRootCauseSuggestion: { not: null },
      aiRootCauseConfidence: { gt: 0.65 },
    },
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      priority: true,
      municipalityName: true,
      districtName: true,
      provinceName: true,
      wardNumber: true,
      latitude: true,
      longitude: true,
      aiRootCauseSuggestion: true,
      aiRootCauseReason: true,
      aiRootCauseConfidence: true,
      aiRootCauseRelatedIds: true,
      createdAt: true,
    },
    orderBy: { aiRootCauseConfidence: "desc" },
  });
}
