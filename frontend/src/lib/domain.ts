/**
 * Domain types and labels. Mirrors the database enums (supabase/migrations, DataBasePRD.md) and
 * backend/app/schemas.py. Change all three together.
 */

// ------------------------------------------------- roles (DataBasePRD 4; one creator role)

export const ROLES = ["admin", "manager", "creator", "reviewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Brand manager",
  creator: "Creator",
  reviewer: "Authorised reviewer",
};

/** company = internal staff; own_work = external creator/agency, sees only their own work. */
export type AccessScope = "company" | "own_work";

export const SCOPE_LABEL: Record<AccessScope, string> = {
  company: "Internal",
  own_work: "External",
};

// ------------------------------------------------------------ submission status (DataBasePRD 5.3)

export const STATUSES = ["draft", "in_review", "changes_requested", "approved", "rejected", "released"] as const;
export type SubmissionStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released",
};

// ------------------------------------------------------------------------------ risk

export const RISKS = ["low", "medium", "high"] as const;
export type Risk = (typeof RISKS)[number];

export const RISK_LABEL: Record<Risk, string> = { low: "Low", medium: "Medium", high: "High" };

// ------------------------------------------------------------------- agent autonomy

export const AUTONOMY_LEVELS = ["auto_fix", "ask_first", "recommend_only"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  auto_fix: "Auto-fix",
  ask_first: "Ask first",
  recommend_only: "Recommend only",
};

// --------------------------------------------------------------------- content

export const CHANNELS = ["instagram", "youtube", "linkedin", "blog", "email", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  blog: "Blog",
  email: "Email",
  other: "Other",
};

export const CONTENT_TYPES = ["text", "image", "document", "video"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type VisibilityClass = "public_to_creators" | "internal" | "confidential" | "local_only";

// -------------------------------------------------------------------- people

export type Id = string;

export interface Organization {
  id: Id;
  name: string;
}

export interface Membership {
  orgId: Id;
  role: Role;
  scope: AccessScope;
  status: "invited" | "active" | "suspended";
}

export interface User {
  id: Id;
  name: string;
  email: string;
  memberships: Membership[];
}
