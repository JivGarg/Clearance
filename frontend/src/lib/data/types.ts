import type { Channel, ContentType, Risk, Role, SubmissionStatus, VisibilityClass } from "@/lib/domain";

/**
 * Row types for the demo store. Each mirrors one table in supabase/migrations (DataBasePRD 5),
 * in camelCase, so the Supabase data layer can replace the store without touching screens.
 * Types marked "demo store only" have NO table yet (see CONTEXT.md, open schema questions).
 */

export type Iso = string; // ISO timestamp
export type DateOnly = string; // YYYY-MM-DD

export interface OrganizationRow {
  organizationId: string;
  companyName: string;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface UserRow {
  userId: string;
  name: string;
  email: string;
  createdAt: Iso;
}

export type MembershipStatus = "invited" | "active" | "suspended";

export interface MembershipRow {
  membershipId: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: MembershipStatus;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface GuidelineRow {
  guidelineId: string;
  organizationId: string;
  rule: string;
  category: string;
  version: number;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface AssetRow {
  assetId: string;
  organizationId: string;
  storagePath: string;
  assetType: string;
  visibility: VisibilityClass;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface FactRow {
  factId: string;
  organizationId: string;
  fact: string;
  source: string;
  validUntil: Iso | null;
  confidentialityLevel: VisibilityClass;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface EmbargoRow {
  embargoId: string;
  organizationId: string;
  restrictedItem: string;
  releaseAt: Iso;
  visibility: VisibilityClass;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface CampaignRow {
  campaignId: string;
  organizationId: string;
  campaignName: string;
  startDate: DateOnly | null;
  endDate: DateOnly | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface SubmissionRow {
  submissionId: string;
  organizationId: string;
  campaignId: string | null;
  createdByUserId: string;
  contentPath: string;
  type: ContentType;
  channel: Channel;
  status: SubmissionStatus;
  intentSummary: string | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface RevisionRow {
  revisionId: string;
  submissionId: string;
  editedByUserId: string;
  version: number;
  contentPath: string;
  changeSummary: string | null;
  createdAt: Iso;
}

export type AssignmentStatus = "pending" | "done" | "overdue";

export interface AssignmentRow {
  assignmentId: string;
  submissionId: string;
  reviewerUserId: string;
  deadline: Iso | null;
  status: AssignmentStatus;
  createdAt: Iso;
  updatedAt: Iso;
}

export type DecisionKind = "approved" | "rejected" | "changes_requested";

export interface DecisionRow {
  decisionId: string;
  submissionId: string;
  revisionId: string;
  reviewerUserId: string;
  decision: DecisionKind;
  comments: string | null;
  decidedAt: Iso;
}

export interface CheckRow {
  checkId: string;
  submissionId: string;
  revisionId: string | null;
  riskLevel: Risk;
  checkedAt: Iso;
  serviceUsed: string;
  result: { mock?: boolean; summary?: string };
}

export type SourceType = "guideline" | "fact" | "embargo" | "asset";

export interface IssueRow {
  issueId: string;
  checkId: string;
  issueType: string;
  explanation: string;
  sourceType: SourceType;
  sourceId: string;
  riskLevel: Risk;
  suggestedFix: string | null;
  createdAt: Iso;
}

export interface AgentActionRow {
  actionId: string;
  submissionId: string;
  action: string;
  reason: string;
  undoData: Record<string, unknown> | null;
  createdAt: Iso;
}

export interface NotificationRow {
  notificationId: string;
  recipientUserId: string;
  submissionId: string | null;
  message: string;
  readAt: Iso | null;
  createdAt: Iso;
}

// ------------------------------------------------------------ demo store only (no table yet)

export type LowAutonomy = "auto_fix" | "ask_first" | "recommend_only";
export type MediumAutonomy = "ask_first" | "recommend_only";

/** designPRD 4.6. High risk is not configurable: always a hold plus authorised reviewer. */
export interface AgentSettingsRow {
  organizationId: string;
  lowRisk: LowAutonomy;
  mediumRisk: MediumAutonomy;
  maxCheckAttempts: number;
  reviewDeadlineHours: number;
  updatedAt: Iso;
}

/** designPRD 4.1: default timezone. Not a column on organizations yet. */
export interface OrgSettingsRow {
  organizationId: string;
  timezone: string;
}

/** designPRD 6: admin changes (memberships, knowledge, settings) need an audit trail. */
export interface AdminEventRow {
  eventId: string;
  organizationId: string;
  actorUserId: string;
  action: string;
  detail: string;
  createdAt: Iso;
}
