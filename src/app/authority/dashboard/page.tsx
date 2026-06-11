import { requireRole } from "@/lib/session";
import { Role, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDashboardStats,
  getAttentionIssues,
  getRootCauseSuggestions,
  getPendingChainAlerts,
  getMunicipalityAnalytics,
  getEmployeePerformance,
  scopeForUser,
  type EmployeePerformance,
} from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { IssueCardBody } from "@/components/civic/issue-card";
import { SelectIssue } from "@/components/civic/select-issue";
import { CascadeChainCard } from "@/components/civic/cascade-chain-card";
import { IssueStatusBadge } from "@/components/civic/issue-status-badge";
import { PriorityBadge } from "@/components/civic/priority-badge";
import { VerifyIssueDialog } from "@/components/civic/verify-issue-dialog";
import { RootCauseSuggestionCard } from "@/components/civic/root-cause-suggestion-card";
import { RequestStatePanel } from "@/components/civic/request-officer-dialog";
import { AssignmentRequestActions } from "@/components/civic/assignment-request-actions";
import { AttentionBadge } from "@/components/civic/attention-badge";
import {
  MunicipalityAnalyticsPanel,
  TeamPerformancePanel,
  type TeamMember,
} from "@/components/civic/dashboard-analytics";
import {
  AuthorityIssueMap,
  type MapStat,
} from "@/components/civic/authority-issue-map";
import { categoriesForDepartment, DEPARTMENT_LABELS } from "@/lib/departments";
import { cn } from "@/lib/utils";

const issueCardSelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  priority: true,
  reportCount: true,
  communityImpactScore: true,
  affectedCitizenCount: true,
  confirmCount: true,
  disputeCount: true,
  wardNumber: true,
  municipalityName: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
  dueDate: true,
} satisfies Prisma.IssueSelect;

// Section-head queue + officer inbox also need the pending-request marker.
const queueSelect = {
  ...issueCardSelect,
  requestedToId: true,
  requestedTo: { select: { name: true } },
} satisfies Prisma.IssueSelect;

export default async function AuthorityDashboardPage() {
  const user = await requireRole([Role.LOCAL_BODY_EMPLOYEE, Role.LOCAL_BODY_HEAD]);
  const isHead = user.role === Role.LOCAL_BODY_HEAD;
  const scope = scopeForUser(user);

  const me = isHead
    ? null
    : await prisma.user.findUnique({
        where: { id: user.id },
        select: { isSectionHead: true, department: true },
      });
  const sectionDept = me?.isSectionHead ? me.department : null;

  // What the map shows:
  //  • HEAD            → the whole municipality
  //  • section head    → every issue in their section (any status/officer) + their own
  //  • plain officer   → only issues assigned to them
  const mapScope: Prisma.IssueWhereInput = isHead
    ? scope
    : sectionDept
    ? {
        ...scope,
        OR: [
          { category: { in: categoriesForDepartment(sectionDept) } },
          { assignedToId: user.id },
          { requestedToId: user.id },
        ],
      }
    : { ...scope, OR: [{ assignedToId: user.id }, { requestedToId: user.id }] };

  const [
    stats,
    attentionIssues,
    submittedIssues,
    allIssues,
    rootCauseSuggestions,
    sectionQueue,
    chainAlerts,
    myRequests,
    analytics,
    teamPerf,
    officers,
  ] = await Promise.all([
      getDashboardStats(scope),
      getAttentionIssues(scope),
      isHead
        ? prisma.issue.findMany({
            where: { ...scope, status: "SUBMITTED" },
            orderBy: { communityImpactScore: "desc" },
            take: 20,
            select: issueCardSelect,
          })
        : Promise.resolve([]),
      prisma.issue.findMany({
        where: mapScope,
        orderBy: [{ communityImpactScore: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: issueCardSelect,
      }),
      isHead ? getRootCauseSuggestions(scope) : Promise.resolve([]),
      sectionDept
        ? prisma.issue.findMany({
            where: {
              ...scope,
              status: "VERIFIED",
              category: { in: categoriesForDepartment(sectionDept) },
            },
            orderBy: [{ communityImpactScore: "desc" }, { createdAt: "desc" }],
            take: 30,
            select: queueSelect,
          })
        : Promise.resolve([]),
      isHead ? getPendingChainAlerts(scope) : Promise.resolve([]),
      // Officer's inbox: VERIFIED issues this user has been requested to take.
      user.role === Role.LOCAL_BODY_EMPLOYEE
        ? prisma.issue.findMany({
            where: { ...scope, status: "VERIFIED", requestedToId: user.id },
            orderBy: { requestedAt: "desc" },
            take: 30,
            select: queueSelect,
          })
        : Promise.resolve([]),
      // HEAD analytics + team performance.
      isHead ? getMunicipalityAnalytics(scope) : Promise.resolve(null),
      isHead ? getEmployeePerformance(scope) : Promise.resolve({} as Record<string, EmployeePerformance>),
      isHead
        ? prisma.user.findMany({
            where: {
              role: Role.LOCAL_BODY_EMPLOYEE,
              municipalityName: user.municipalityName ?? undefined,
              isActive: true,
            },
            select: { id: true, name: true, department: true },
          })
        : Promise.resolve([]),
    ]);

  // Combine officers with their factual performance for the team panel.
  const teamMembers: TeamMember[] = officers.map((o) => ({
    id: o.id,
    name: o.name,
    department: o.department,
    perf: teamPerf[o.id] ?? {
      open: 0,
      resolved: 0,
      avgResolutionDays: null,
      oldestOpenDays: null,
      pastThreshold: 0,
      committedResolved: 0,
      onTime: 0,
      onTimeRate: null,
      reopened: 0,
    },
  }));

  const headerTitle = isHead
    ? "Municipality Dashboard"
    : sectionDept
    ? `${DEPARTMENT_LABELS[sectionDept]} — Section`
    : "My Assigned Issues";
  const headerSubtitle =
    (sectionDept ? "Section head · " : "") +
    ([user.municipalityName, user.districtName, user.provinceName]
      .filter(Boolean)
      .join(" · ") || "Your jurisdiction");

  const statChips: MapStat[] = [
    { label: "Open", value: stats.open },
    { label: "Pending", value: stats.byStatus.SUBMITTED },
    { label: "Attention", value: stats.attentionCount, alert: true },
    { label: "Resolved", value: stats.byStatus.RESOLVED },
  ];

  return (
    <AuthorityIssueMap
      issues={allIssues}
      isHead={isHead}
      sectionDept={sectionDept}
      currentUserId={user.id}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      stats={statChips}
    >
      {/* Requests for you — officer inbox */}
      {myRequests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">
              Requests for You
            </h2>
            <Badge variant="secondary">{myRequests.length}</Badge>
          </div>
          <div className="space-y-2">
            {myRequests.map((issue) => (
              <div key={issue.id} className="space-y-2">
                <SelectIssue issueId={issue.id}>
                  <IssueCardBody issue={issue} />
                </SelectIssue>
                <AssignmentRequestActions issueId={issue.id} issueTitle={issue.title} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section assignment queue — section heads only */}
      {sectionDept && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">
              Awaiting Assignment — {DEPARTMENT_LABELS[sectionDept]}
            </h2>
            <Badge variant="secondary">{sectionQueue.length}</Badge>
          </div>
          {sectionQueue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing waiting. Verified issues for your section appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {sectionQueue.map((issue) => (
                <div key={issue.id} className="space-y-2">
                  <SelectIssue issueId={issue.id}>
                    <IssueCardBody issue={issue} />
                  </SelectIssue>
                  <RequestStatePanel
                    issueId={issue.id}
                    issueTitle={issue.title}
                    issueCategory={issue.category}
                    requestedToName={issue.requestedTo?.name ?? null}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Root cause suggestions — HEAD only */}
      {isHead && rootCauseSuggestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-simrik" />
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">Root Cause Suggestions</h2>
            <Badge variant="secondary">{rootCauseSuggestions.length}</Badge>
          </div>
          <div className="space-y-3">
            {rootCauseSuggestions.map((s) => (
              <RootCauseSuggestionCard
                key={s.id}
                issueId={s.id}
                suggestion={s.aiRootCauseSuggestion ?? ""}
                reason={s.aiRootCauseReason ?? ""}
                confidence={s.aiRootCauseConfidence ?? 0}
                relatedIds={s.aiRootCauseRelatedIds}
                category={s.category}
                municipalityName={s.municipalityName}
                districtName={s.districtName}
                provinceName={s.provinceName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Cascading complaints — HEAD only */}
      {isHead && chainAlerts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">Cascading Complaints</h2>
            <Badge variant="secondary">{chainAlerts.length}</Badge>
          </div>
          <div className="space-y-2">
            {chainAlerts.map((alert) => (
              <CascadeChainCard
                key={alert.root.id}
                root={alert.root}
                downstream={alert.downstream}
                linkedCount={alert.linkedCount}
              />
            ))}
          </div>
        </section>
      )}

      {/* Verification queue — HEAD only */}
      {isHead && submittedIssues.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">Needs Verification</h2>
            <Badge variant="secondary">{submittedIssues.length}</Badge>
          </div>
          <div className="space-y-2">
            {submittedIssues.map((issue) => (
              <div key={issue.id} className="space-y-2">
                <SelectIssue issueId={issue.id}>
                  <IssueCardBody issue={issue} />
                </SelectIssue>
                <div className="flex justify-end">
                  <VerifyIssueDialog
                    issueId={issue.id}
                    issueTitle={issue.title}
                    affectedCitizenCount={issue.affectedCitizenCount}
                    confirmCount={issue.confirmCount}
                    disputeCount={issue.disputeCount}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Municipality analytics + team performance — HEAD only */}
      {isHead && analytics && <MunicipalityAnalyticsPanel data={analytics} />}
      {isHead && <TeamPerformancePanel members={teamMembers} />}

      {/* Needs attention */}
      {attentionIssues.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-nilo">Needs Attention</h2>
            <Badge variant="secondary">{attentionIssues.length}</Badge>
          </div>
          <div className="space-y-2">
            {attentionIssues.map((issue) => {
              const borderClass =
                issue.attention.daysInStatus > issue.attention.limit * 2
                  ? "border-l-4 border-red-500"
                  : "border-l-4 border-amber-500";
              return (
                <SelectIssue key={issue.id} issueId={issue.id}>
                  <Card className={cn("p-3 transition-colors hover:bg-muted/40", borderClass)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={issue.priority} />
                          <IssueStatusBadge status={issue.status} />
                        </div>
                        <p className="truncate font-medium">
                          {issue.title}
                          {issue.wardNumber ? ` — Ward ${issue.wardNumber}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {issue.assignedTo?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <AttentionBadge
                          status={issue.status}
                          updatedAt={issue.updatedAt}
                          dueDate={issue.dueDate}
                        />
                      </div>
                    </div>
                  </Card>
                </SelectIssue>
              );
            })}
          </div>
        </section>
      )}
    </AuthorityIssueMap>
  );
}
