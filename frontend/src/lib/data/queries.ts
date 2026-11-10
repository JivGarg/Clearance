import "server-only";
import type { Channel, Risk, Role, SubmissionStatus, VisibilityClass } from "@/lib/domain";
import { db } from "@/lib/data/store";
import type {
  AgentActionRow,
  AssetRow,
  AssignmentRow,
  CampaignRow,
  CheckRow,
  DecisionRow,
  EmbargoRow,
  FactRow,
  GuidelineRow,
  IssueRow,
  MembershipRow,
  NotificationRow,
  RevisionRow,
  SourceType,
  SubmissionRow,
} from "@/lib/data/types";

/**
 * Reads, filtered exactly like the row-level security in supabase/migrations/..03_rls.sql
 * (DataBasePRD 4). Every function takes the Actor and only returns rows that actor may see in
 * that company. When Supabase lands, these become queries and RLS does the filtering.
 */

export interface Actor {
  userId: string;
  orgId: string;
  role: Role;
}

const STAFF: readonly Role[] = ["admin", "manager"];
export const isStaff = (a: Actor) => STAFF.includes(a.role);

// ------------------------------------------------------------------ access (mirrors SQL helpers)

/** can_see_class: staff and reviewers see everything; creators public + internal. */
export function canSeeClass(a: Actor, cls: VisibilityClass): boolean {
  if (a.role === "creator") return cls === "public_to_creators" || cls === "internal";
  return true;
}

/** can_view_submission. */
export function canViewSubmission(a: Actor, sub: SubmissionRow): boolean {
  if (sub.organizationId !== a.orgId) return false;
  if (isStaff(a)) return true;
  if (a.role === "creator") return sub.createdByUserId === a.userId;
  return db().assignments.some((x) => x.submissionId === sub.submissionId && x.reviewerUserId === a.userId);
}

/** can_see_source. */
export function canSeeSource(a: Actor, type: SourceType, id: string): boolean {
  const d = db();
  switch (type) {
    case "guideline":
      return d.guidelines.some((g) => g.guidelineId === id && g.organizationId === a.orgId);
    case "fact": {
      const f = d.facts.find((x) => x.factId === id && x.organizationId === a.orgId);
      return !!f && canSeeClass(a, f.confidentialityLevel);
    }
    case "embargo": {
      const e = d.embargoes.find((x) => x.embargoId === id && x.organizationId === a.orgId);
      return !!e && canSeeClass(a, e.visibility);
    }
    case "asset": {
      const x = d.assets.find((r) => r.assetId === id && r.organizationId === a.orgId);
      return !!x && canSeeClass(a, x.visibility);
    }
  }
}

export function latestRevision(submissionId: string): RevisionRow | undefined {
  return db()
    .revisions.filter((r) => r.submissionId === submissionId)
    .sort((x, y) => y.version - x.version)[0];
}

export const isActiveEmbargo = (e: EmbargoRow, now = Date.now()) => Date.parse(e.releaseAt) > now;
export const isCurrentFact = (f: FactRow, now = Date.now()) => f.validUntil === null || Date.parse(f.validUntil) > now;

/** has_active_embargo: an unreleased embargo cited by a check on the current revision. */
export function hasActiveEmbargo(submissionId: string): boolean {
  const d = db();
  const latest = latestRevision(submissionId)?.revisionId;
  const checkIds = new Set(
    d.checks.filter((c) => c.submissionId === submissionId && (c.revisionId === null || c.revisionId === latest)).map((c) => c.checkId),
  );
  return d.issues.some((i) => {
    if (!checkIds.has(i.checkId) || i.sourceType !== "embargo") return false;
    const e = d.embargoes.find((x) => x.embargoId === i.sourceId);
    return !!e && isActiveEmbargo(e);
  });
}

// ------------------------------------------------------------------------- people

export function userName(userId: string): string {
  return db().users.find((x) => x.userId === userId)?.name ?? "Unknown person";
}

export function orgRow(orgId: string) {
  return db().organizations.find((o) => o.organizationId === orgId);
}

export function orgSettings(orgId: string) {
  return db().orgSettings.find((o) => o.organizationId === orgId);
}

export function agentSettings(orgId: string) {
  return db().agentSettings.find((o) => o.organizationId === orgId);
}

export interface MemberView extends MembershipRow {
  name: string;
  email: string;
  openAssignments: number;
}

/** Matrix: admin edit, manager view, others only their own membership. */
export function listMembers(a: Actor): MemberView[] {
  const d = db();
  return d.memberships
    .filter((m) => m.organizationId === a.orgId && (isStaff(a) || m.userId === a.userId))
    .map((m) => {
      const user = d.users.find((x) => x.userId === m.userId)!;
      const openAssignments = d.assignments.filter(
        (x) =>
          x.reviewerUserId === m.userId &&
          x.status !== "done" &&
          d.submissions.some((s) => s.submissionId === x.submissionId && s.organizationId === a.orgId),
      ).length;
      return { ...m, name: user.name, email: user.email, openAssignments };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
}

// ---------------------------------------------------------------------- knowledge

const inOrg = <T extends { organizationId: string }>(a: Actor) => (row: T) => row.organizationId === a.orgId;
const byUpdated = <T extends { updatedAt: string }>(x: T, y: T) => y.updatedAt.localeCompare(x.updatedAt);

export function listGuidelines(a: Actor): GuidelineRow[] {
  return db().guidelines.filter(inOrg(a)).sort(byUpdated);
}

export function listFacts(a: Actor): FactRow[] {
  return db().facts.filter(inOrg(a)).filter((f) => canSeeClass(a, f.confidentialityLevel)).sort(byUpdated);
}

export function listAssets(a: Actor): AssetRow[] {
  return db().assets.filter(inOrg(a)).filter((x) => canSeeClass(a, x.visibility)).sort(byUpdated);
}

export function listEmbargoes(a: Actor): EmbargoRow[] {
  return db()
    .embargoes.filter(inOrg(a))
    .filter((e) => canSeeClass(a, e.visibility))
    .sort((x, y) => x.releaseAt.localeCompare(y.releaseAt));
}

export interface CampaignView extends CampaignRow {
  submissionCount: number;
  byChannel: Partial<Record<Channel, number>>;
  clearedCount: number;
}

export function listCampaigns(a: Actor): CampaignView[] {
  const subs = visibleSubmissions(a);
  return db()
    .campaigns.filter(inOrg(a))
    .map((c) => {
      const mine = subs.filter((s) => s.campaignId === c.campaignId);
      const byChannel: Partial<Record<Channel, number>> = {};
      for (const s of mine) byChannel[s.channel] = (byChannel[s.channel] ?? 0) + 1;
      return {
        ...c,
        submissionCount: mine.length,
        byChannel,
        clearedCount: mine.filter((s) => s.status === "approved" || s.status === "released").length,
      };
    })
    .sort((x, y) => (y.startDate ?? "").localeCompare(x.startDate ?? ""));
}

export type SourceView =
  | { type: "guideline"; row: GuidelineRow; title: string }
  | { type: "fact"; row: FactRow; title: string }
  | { type: "asset"; row: AssetRow; title: string }
  | { type: "embargo"; row: EmbargoRow; title: string };

export function sourceTitle(a: Actor, type: SourceType, id: string): string | null {
  return findSource(a, id, type)?.title ?? null;
}

/** One knowledge item by id, if the actor may see it (embargoes included for citations). */
export function findSource(a: Actor, id: string, only?: SourceType): SourceView | null {
  const d = db();
  const g = d.guidelines.find((x) => x.guidelineId === id && x.organizationId === a.orgId);
  if (g && (!only || only === "guideline")) return { type: "guideline", row: g, title: `${capitalise(g.category)} guideline v${g.version}` };
  const f = d.facts.find((x) => x.factId === id && x.organizationId === a.orgId);
  if (f && (!only || only === "fact") && canSeeClass(a, f.confidentialityLevel)) return { type: "fact", row: f, title: `Fact: ${f.source}` };
  const x = d.assets.find((r) => r.assetId === id && r.organizationId === a.orgId);
  if (x && (!only || only === "asset") && canSeeClass(a, x.visibility)) return { type: "asset", row: x, title: `Asset: ${x.storagePath.split("/").pop()}` };
  const e = d.embargoes.find((r) => r.embargoId === id && r.organizationId === a.orgId);
  if (e && (!only || only === "embargo") && canSeeClass(a, e.visibility)) return { type: "embargo", row: e, title: `Embargo: ${e.restrictedItem}` };
  return null;
}

/** Findings that cite a source, on submissions the actor may see. */
export function citationsOf(a: Actor, sourceId: string) {
  const d = db();
  return d.issues
    .filter((i) => i.sourceId === sourceId)
    .map((i) => {
      const check = d.checks.find((c) => c.checkId === i.checkId)!;
      const sub = d.submissions.find((s) => s.submissionId === check.submissionId)!;
      return { issue: i, submission: sub };
    })
    .filter(({ submission }) => canViewSubmission(a, submission));
}

// --------------------------------------------------------------------- submissions

export function visibleSubmissions(a: Actor): SubmissionRow[] {
  return db().submissions.filter((s) => canViewSubmission(a, s));
}

export interface SubmissionListItem extends SubmissionRow {
  creatorName: string;
  campaignName: string | null;
  risk: Risk | null;
  findingCount: number;
  version: number;
  embargoHold: boolean;
}

export interface SubmissionFilters {
  q?: string;
  status?: SubmissionStatus;
  channel?: Channel;
  campaignId?: string;
  sort?: "newest" | "oldest";
}

function latestCheck(submissionId: string): CheckRow | undefined {
  const latest = latestRevision(submissionId)?.revisionId;
  return db()
    .checks.filter((c) => c.submissionId === submissionId && (c.revisionId === null || c.revisionId === latest))
    .sort((x, y) => y.checkedAt.localeCompare(x.checkedAt))[0];
}

function toListItem(s: SubmissionRow): SubmissionListItem {
  const d = db();
  const check = latestCheck(s.submissionId);
  return {
    ...s,
    creatorName: userName(s.createdByUserId),
    campaignName: d.campaigns.find((c) => c.campaignId === s.campaignId)?.campaignName ?? null,
    risk: check?.riskLevel ?? null,
    findingCount: check ? d.issues.filter((i) => i.checkId === check.checkId).length : 0,
    version: latestRevision(s.submissionId)?.version ?? 0,
    embargoHold: hasActiveEmbargo(s.submissionId),
  };
}

export function listSubmissions(a: Actor, f: SubmissionFilters = {}): SubmissionListItem[] {
  const q = f.q?.trim().toLowerCase();
  const rows = visibleSubmissions(a)
    .filter((s) => !f.status || s.status === f.status)
    .filter((s) => !f.channel || s.channel === f.channel)
    .filter((s) => !f.campaignId || s.campaignId === f.campaignId)
    .map(toListItem)
    .filter(
      (s) =>
        !q ||
        [s.intentSummary, s.creatorName, s.campaignName, s.contentPath].some((v) => v?.toLowerCase().includes(q)),
    );
  rows.sort((x, y) => (f.sort === "oldest" ? x.createdAt.localeCompare(y.createdAt) : y.createdAt.localeCompare(x.createdAt)));
  return rows;
}

export interface FindingView extends IssueRow {
  sourceTitle: string | null;
}

export interface CheckView extends CheckRow {
  findings: FindingView[];
  restrictedCount: number;
  revisionVersion: number | null;
}

export interface SubmissionDetail {
  submission: SubmissionListItem;
  revisions: (RevisionRow & { editorName: string })[];
  checks: CheckView[];
  assignments: (AssignmentRow & { reviewerName: string })[];
  decisions: (DecisionRow & { reviewerName: string; revisionVersion: number | null })[];
  agentActions: AgentActionRow[];
  canRelease: boolean;
  releaseBlockedReason: string | null;
}

export function getSubmission(a: Actor, id: string): SubmissionDetail | null {
  const d = db();
  const sub = d.submissions.find((s) => s.submissionId === id);
  if (!sub || !canViewSubmission(a, sub)) return null; // same answer for "missing" and "not yours"
  const versionOf = (revisionId: string | null) => d.revisions.find((r) => r.revisionId === revisionId)?.version ?? null;

  const checks: CheckView[] = d.checks
    .filter((c) => c.submissionId === id)
    .sort((x, y) => y.checkedAt.localeCompare(x.checkedAt))
    .map((c) => {
      const all = d.issues.filter((i) => i.checkId === c.checkId);
      const visible = all.filter((i) => canSeeSource(a, i.sourceType, i.sourceId));
      return {
        ...c,
        findings: visible.map((i) => ({ ...i, sourceTitle: sourceTitle(a, i.sourceType, i.sourceId) })),
        restrictedCount: all.length - visible.length,
        revisionVersion: versionOf(c.revisionId),
      };
    });

  const embargo = hasActiveEmbargo(id);
  const canRelease = isStaff(a) && sub.status === "approved" && !embargo;
  return {
    submission: toListItem(sub),
    revisions: d.revisions
      .filter((r) => r.submissionId === id)
      .sort((x, y) => y.version - x.version)
      .map((r) => ({ ...r, editorName: userName(r.editedByUserId) })),
    checks,
    assignments: d.assignments
      .filter((x) => x.submissionId === id && (a.role !== "reviewer" || x.reviewerUserId === a.userId))
      .map((x) => ({ ...x, reviewerName: userName(x.reviewerUserId) })),
    decisions: d.decisions
      .filter((x) => x.submissionId === id)
      .sort((x, y) => y.decidedAt.localeCompare(x.decidedAt))
      .map((x) => ({ ...x, reviewerName: userName(x.reviewerUserId), revisionVersion: versionOf(x.revisionId) })),
    agentActions: isStaff(a)
      ? d.agentActions.filter((x) => x.submissionId === id).sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      : [],
    canRelease,
    releaseBlockedReason:
      sub.status === "approved" && embargo ? "Cites an active embargo. It can be released once the embargo lifts and it is reviewed again." : null,
  };
}

// --------------------------------------------------------------------- notifications

export function listNotifications(userId: string): NotificationRow[] {
  return db()
    .notifications.filter((n) => n.recipientUserId === userId)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

export function unreadCount(userId: string): number {
  return db().notifications.filter((n) => n.recipientUserId === userId && n.readAt === null).length;
}

// --------------------------------------------------------------------- metrics

export interface Metrics {
  total: number;
  byStatus: Record<SubmissionStatus, number>;
  cleared: number;
  inReview: number;
  highRiskHolds: number;
  autoFixes: number;
  /** cleared / submissions that reached a decision; null when nothing was decided (show N/A). */
  clearanceRate: number | null;
  /** Hours from assignment to decision; null with no decisions. */
  avgReviewHours: number | null;
  findingsByRisk: Record<Risk, number>;
  topIssueTypes: { label: string; count: number }[];
  topGuidelines: { id: string; label: string; count: number }[];
  weekly: { label: string; start: string; submitted: number; cleared: number }[];
}

const STATUSES: SubmissionStatus[] = ["draft", "in_review", "changes_requested", "approved", "rejected", "released"];

export function metrics(a: Actor, f: Pick<SubmissionFilters, "channel" | "campaignId"> = {}, weeks = 6): Metrics {
  const d = db();
  const subs = visibleSubmissions(a)
    .filter((s) => !f.channel || s.channel === f.channel)
    .filter((s) => !f.campaignId || s.campaignId === f.campaignId);
  const ids = new Set(subs.map((s) => s.submissionId));

  const byStatus = Object.fromEntries(STATUSES.map((st) => [st, 0])) as Record<SubmissionStatus, number>;
  for (const s of subs) byStatus[s.status]++;
  const cleared = byStatus.approved + byStatus.released;

  const decisions = d.decisions.filter((x) => ids.has(x.submissionId));
  const decidedSubs = new Set(decisions.map((x) => x.submissionId));
  const clearedDecided = subs.filter((s) => decidedSubs.has(s.submissionId) && (s.status === "approved" || s.status === "released")).length;

  const turnaround = decisions
    .map((x) => {
      const asg = d.assignments.find((g) => g.submissionId === x.submissionId && g.reviewerUserId === x.reviewerUserId);
      return asg ? (Date.parse(x.decidedAt) - Date.parse(asg.createdAt)) / 3_600_000 : null;
    })
    .filter((h): h is number => h !== null && h >= 0);

  // Findings on the current revision of each submission, visible to this actor.
  const findings = subs.flatMap((s) => {
    const c = latestCheck(s.submissionId);
    return c ? d.issues.filter((i) => i.checkId === c.checkId && canSeeSource(a, i.sourceType, i.sourceId)) : [];
  });
  const findingsByRisk: Record<Risk, number> = { low: 0, medium: 0, high: 0 };
  for (const i of findings) findingsByRisk[i.riskLevel]++;

  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  };
  const topIssueTypes = count(findings.map((i) => i.issueType)).slice(0, 6).map(([label, n]) => ({ label, count: n }));
  const topGuidelines = count(findings.filter((i) => i.sourceType === "guideline").map((i) => i.sourceId))
    .slice(0, 5)
    .map(([id, n]) => ({ id, label: d.guidelines.find((g) => g.guidelineId === id)?.rule ?? "Guideline", count: n }));

  // Weekly buckets ending today: submitted by created_at; cleared by approval decision time.
  const WEEK = 7 * 86_400_000;
  const end = Date.now();
  const approvals = decisions.filter((x) => x.decision === "approved");
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = end - (weeks - i) * WEEK;
    const stop = start + WEEK;
    const inWeek = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) < stop;
    return {
      label: new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      start: new Date(start).toISOString(),
      submitted: subs.filter((s) => inWeek(s.createdAt)).length,
      cleared: approvals.filter((x) => inWeek(x.decidedAt)).length,
    };
  });

  return {
    total: subs.length,
    byStatus,
    cleared,
    inReview: byStatus.in_review,
    highRiskHolds: subs.filter((s) => s.status === "in_review" && latestCheck(s.submissionId)?.riskLevel === "high").length,
    autoFixes: d.agentActions.filter((x) => ids.has(x.submissionId) && x.action === "auto_fix_applied").length,
    clearanceRate: decidedSubs.size ? clearedDecided / decidedSubs.size : null,
    avgReviewHours: turnaround.length ? turnaround.reduce((p, q) => p + q, 0) / turnaround.length : null,
    findingsByRisk,
    topIssueTypes,
    topGuidelines,
    weekly,
  };
}

// ---------------------------------------------------------------------- audit

export type AuditKind = "revision" | "check" | "decision" | "agent" | "admin";

export interface AuditEntry {
  id: string;
  kind: AuditKind;
  at: string;
  actor: string;
  summary: string;
  submissionId: string | null;
  /** true when the record exists only in the demo store (no database table yet). */
  demoOnly: boolean;
}

/** Tamper-evident timeline (designPRD 3): every row comes from an append-only table. Staff only. */
export function auditTimeline(a: Actor, kind?: AuditKind): AuditEntry[] {
  if (!isStaff(a)) return [];
  const d = db();
  const subIds = new Set(d.submissions.filter((s) => s.organizationId === a.orgId).map((s) => s.submissionId));
  const label = (sid: string) => d.submissions.find((s) => s.submissionId === sid)?.intentSummary ?? "a submission";
  const entries: AuditEntry[] = [
    ...d.revisions
      .filter((r) => subIds.has(r.submissionId))
      .map((r) => ({
        id: r.revisionId,
        kind: "revision" as const,
        at: r.createdAt,
        actor: userName(r.editedByUserId),
        summary: `Uploaded version ${r.version} of "${label(r.submissionId)}"${r.changeSummary ? `: ${r.changeSummary}` : ""}`,
        submissionId: r.submissionId,
        demoOnly: false,
      })),
    ...d.checks
      .filter((c) => subIds.has(c.submissionId))
      .map((c) => ({
        id: c.checkId,
        kind: "check" as const,
        at: c.checkedAt,
        actor: `Check service (${c.serviceUsed})`,
        summary: `${capitalise(c.riskLevel)}-risk result on "${label(c.submissionId)}"`,
        submissionId: c.submissionId,
        demoOnly: false,
      })),
    ...d.decisions
      .filter((x) => subIds.has(x.submissionId))
      .map((x) => ({
        id: x.decisionId,
        kind: "decision" as const,
        at: x.decidedAt,
        actor: userName(x.reviewerUserId),
        summary: `${DECISION_LABEL[x.decision]} "${label(x.submissionId)}"${x.comments ? `: ${x.comments}` : ""}`,
        submissionId: x.submissionId,
        demoOnly: false,
      })),
    ...d.agentActions
      .filter((x) => subIds.has(x.submissionId))
      .map((x) => ({
        id: x.actionId,
        kind: "agent" as const,
        at: x.createdAt,
        actor: "AI agent",
        summary: `${AGENT_ACTION_LABEL[x.action] ?? x.action}: ${x.reason}`,
        submissionId: x.submissionId,
        demoOnly: false,
      })),
    ...d.adminEvents
      .filter((x) => x.organizationId === a.orgId)
      .map((x) => ({
        id: x.eventId,
        kind: "admin" as const,
        at: x.createdAt,
        actor: userName(x.actorUserId),
        summary: `${x.action}: ${x.detail}`,
        submissionId: null,
        demoOnly: true,
      })),
  ];
  return entries.filter((e) => !kind || e.kind === kind).sort((x, y) => y.at.localeCompare(x.at));
}

export const DECISION_LABEL: Record<DecisionRow["decision"], string> = {
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Requested changes on",
};

export const AGENT_ACTION_LABEL: Record<string, string> = {
  run_check: "Ran a check",
  auto_fix_applied: "Applied a low-risk fix",
  hold: "Placed a hold",
  assign_reviewer: "Assigned a reviewer",
  ask_admin: "Asked an admin",
};

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// --------------------------------------------------------------------- reviews

export interface QueueItem extends SubmissionListItem {
  reviewers: { userId: string; name: string; deadline: string | null }[];
  dueAt: string | null;
}

/** In-review work: a reviewer's own open assignments; everything in review for a manager. */
export function reviewQueue(a: Actor, f: { risk?: Risk; channel?: Channel; campaignId?: string; overdue?: boolean } = {}): QueueItem[] {
  const d = db();
  const now = Date.now();
  return listSubmissions(a, { status: "in_review", channel: f.channel, campaignId: f.campaignId })
    .map((s) => {
      const open = d.assignments.filter((x) => x.submissionId === s.submissionId && x.status !== "done");
      const reviewers = open.map((x) => ({ userId: x.reviewerUserId, name: userName(x.reviewerUserId), deadline: x.deadline }));
      const dueAt = reviewers.map((r) => r.deadline).filter((x): x is string => !!x).sort()[0] ?? null;
      return { ...s, reviewers, dueAt };
    })
    .filter((s) => a.role !== "reviewer" || s.reviewers.some((r) => r.userId === a.userId))
    .filter((s) => !f.risk || s.risk === f.risk)
    .filter((s) => !f.overdue || (s.dueAt !== null && Date.parse(s.dueAt) < now))
    .sort((x, y) => (x.dueAt ?? "9999").localeCompare(y.dueAt ?? "9999"));
}

/** check_assignment: active reviewers of the company who did not create the submission. */
export function eligibleReviewers(a: Actor, submission: SubmissionRow) {
  const d = db();
  return d.memberships
    .filter((m) => m.organizationId === a.orgId && m.role === "reviewer" && m.status === "active" && m.userId !== submission.createdByUserId)
    .map((m) => ({
      userId: m.userId,
      name: userName(m.userId),
      open: d.assignments.filter((x) => x.reviewerUserId === m.userId && x.status !== "done").length,
    }));
}
