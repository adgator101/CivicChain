import { prisma } from "@/lib/prisma";
import { needsAttention, daysSince, ATTENTION_THRESHOLD_DAYS } from "@/lib/utils";
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

  const attention = await getAttentionIssues(where);

  return {
    total,
    open,
    byStatus,
    attentionCount: attention.length,
    resolved: byStatus.RESOLVED,
  };
}

export type AttentionIssue = Awaited<ReturnType<typeof getAttentionIssues>>[number];

// Open issues that have sat in their current status beyond the plain attention
// threshold. Factual age only — no SLA, no priority multiplier.
export async function getAttentionIssues(where: Prisma.IssueWhereInput) {
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
      attention: needsAttention(i.status, i.updatedAt),
    }))
    .filter((i) => i.attention.flagged)
    .sort((a, b) => b.attention.daysInStatus - a.attention.daysInStatus);
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

// Municipality-wide analytics for the HEAD dashboard — factual aggregates only.
export type MunicipalityAnalytics = {
  resolved: number;
  reopened: number;
  avgResolutionDays: number | null;
  onTime: number;
  committedResolved: number;
  onTimeRate: number | null;
  byCategory: { category: string; count: number }[];
};

export async function getMunicipalityAnalytics(
  where: Prisma.IssueWhereInput
): Promise<MunicipalityAnalytics> {
  const issues = await prisma.issue.findMany({
    where,
    select: {
      status: true,
      category: true,
      assignedAt: true,
      resolvedAt: true,
      dueDate: true,
    },
  });

  let resolved = 0;
  let reopened = 0;
  let resSum = 0;
  let resN = 0;
  let onTime = 0;
  let committedResolved = 0;
  const catMap = new Map<string, number>();

  for (const i of issues) {
    catMap.set(i.category, (catMap.get(i.category) ?? 0) + 1);
    if (i.status === IssueStatus.REOPENED) reopened++;
    if (i.status === IssueStatus.RESOLVED) {
      resolved++;
      if (i.assignedAt && i.resolvedAt) {
        const d =
          (new Date(i.resolvedAt).getTime() - new Date(i.assignedAt).getTime()) / 86_400_000;
        if (d >= 0) {
          resSum += d;
          resN++;
        }
      }
      if (i.dueDate && i.resolvedAt) {
        committedResolved++;
        if (new Date(i.resolvedAt).getTime() <= new Date(i.dueDate).getTime()) onTime++;
      }
    }
  }

  const byCategory = [...catMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    resolved,
    reopened,
    avgResolutionDays: resN ? Math.round(resSum / resN) : null,
    onTime,
    committedResolved,
    onTimeRate: committedResolved ? onTime / committedResolved : null,
    byCategory,
  };
}

// Per-employee performance — built entirely from factual durations, no targets or
// scores. Resolution time is measured ONLY over the assigned→resolved window, so an
// officer is never charged for time before the issue reached them.
export type EmployeePerformance = {
  open: number;
  resolved: number;
  avgResolutionDays: number | null;
  oldestOpenDays: number | null;
  pastThreshold: number; // open issues sitting past the ACTIVE attention threshold
  committedResolved: number; // resolved issues that had a committed completion date
  onTime: number; // of those, finished on or before the committed date
  onTimeRate: number | null; // onTime / committedResolved (null if no commitments)
  reopened: number; // resolutions the community sent back (internal signal)
};

export async function getEmployeePerformance(
  where: Prisma.IssueWhereInput
): Promise<Record<string, EmployeePerformance>> {
  const issues = await prisma.issue.findMany({
    where: { ...where, assignedToId: { not: null } },
    select: {
      assignedToId: true,
      status: true,
      assignedAt: true,
      resolvedAt: true,
      dueDate: true,
      updatedAt: true,
    },
  });

  const acc: Record<
    string,
    {
      open: number;
      resolved: number;
      resSum: number;
      resN: number;
      oldestOpen: number;
      past: number;
      committed: number;
      onTime: number;
      reopened: number;
    }
  > = {};

  for (const i of issues) {
    const id = i.assignedToId!;
    const a = (acc[id] ??= {
      open: 0,
      resolved: 0,
      resSum: 0,
      resN: 0,
      oldestOpen: 0,
      past: 0,
      committed: 0,
      onTime: 0,
      reopened: 0,
    });

    if (i.status === IssueStatus.RESOLVED) {
      a.resolved++;
      if (i.assignedAt && i.resolvedAt) {
        const d =
          (new Date(i.resolvedAt).getTime() - new Date(i.assignedAt).getTime()) /
          86_400_000;
        if (d >= 0) {
          a.resSum += d;
          a.resN++;
        }
      }
      // Timely-completion against the officer's OWN committed date (STORY-017).
      if (i.dueDate && i.resolvedAt) {
        a.committed++;
        if (new Date(i.resolvedAt).getTime() <= new Date(i.dueDate).getTime()) {
          a.onTime++;
        }
      }
    } else {
      a.open++;
      const age = daysSince(i.updatedAt);
      if (age > a.oldestOpen) a.oldestOpen = age;
      if (age > ATTENTION_THRESHOLD_DAYS.ACTIVE) a.past++;
      if (i.status === IssueStatus.REOPENED) a.reopened++;
    }
  }

  return Object.fromEntries(
    Object.entries(acc).map(([id, a]) => [
      id,
      {
        open: a.open,
        resolved: a.resolved,
        avgResolutionDays: a.resN ? Math.round(a.resSum / a.resN) : null,
        oldestOpenDays: a.open ? a.oldestOpen : null,
        pastThreshold: a.past,
        committedResolved: a.committed,
        onTime: a.onTime,
        onTimeRate: a.committed ? a.onTime / a.committed : null,
        reopened: a.reopened,
      },
    ])
  );
}

// ─── Cascading issue chains (STORY-010) ───────────────────────────────────────

// Groups of causally-linked issues whose chain root is not yet resolved, scoped
// to the viewer's municipality. Surfaced to LOCAL_BODY_HEAD as "one fix, many
// complaints" alerts.
export async function getPendingChainAlerts(where: Prisma.IssueWhereInput) {
  const links = await prisma.issueChainLink.findMany({
    where: { downstreamIssue: where },
    select: {
      upstreamIssue: { select: { id: true } },
      downstreamIssue: {
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          wardNumber: true,
          municipalityName: true,
          chainRootIssueId: true,
        },
      },
    },
  });
  if (links.length === 0) return [];

  // Group downstream issues by their chain root.
  const byRoot = new Map<string, typeof links[number]["downstreamIssue"][]>();
  for (const l of links) {
    const rootId = l.downstreamIssue.chainRootIssueId ?? l.upstreamIssue.id;
    const list = byRoot.get(rootId) ?? [];
    list.push(l.downstreamIssue);
    byRoot.set(rootId, list);
  }

  const roots = await prisma.issue.findMany({
    where: { id: { in: [...byRoot.keys()] } },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      wardNumber: true,
      municipalityName: true,
    },
  });

  return roots
    // Only alert while the root is still open — once the cause is fixed the
    // cascade-resolve flow takes over.
    .filter((root) => root.status !== IssueStatus.RESOLVED)
    .map((root) => ({
      root,
      downstream: byRoot.get(root.id) ?? [],
      linkedCount: (byRoot.get(root.id) ?? []).length + 1, // + the root itself
    }))
    .sort((a, b) => b.linkedCount - a.linkedCount);
}

// Open issues directly downstream of an upstream issue — used to offer a
// coordinated cascade-resolve once the upstream is fixed.
export async function getDownstreamOpenIssues(upstreamIssueId: string) {
  const links = await prisma.issueChainLink.findMany({
    where: {
      upstreamIssueId,
      downstreamIssue: { status: { in: OPEN_STATUSES } },
    },
    select: {
      downstreamIssue: {
        select: { id: true, title: true, status: true, category: true, wardNumber: true },
      },
    },
  });
  return links.map((l) => l.downstreamIssue);
}
