import type { Membership, Role, User } from "@/lib/domain";

/**
 * Information architecture (designPRD 3 and 2.3). Routes are company-scoped: /org/[orgId]/...
 * Route access here is UX only; the database enforces the real rules (RLS, DataBasePRD 4).
 */

export type NavIcon =
  | "dashboard" | "file" | "check" | "book" | "chart" | "users" | "bot" | "plug"
  | "settings" | "history" | "bell" | "layers" | "lock";

export type PageKey =
  | "dashboard" | "submissions" | "submissions/new" | "reviews" | "campaigns" | "knowledge"
  | "embargoes" | "analytics" | "users" | "agent" | "settings" | "audit" | "notifications";

const ALL: readonly Role[] = ["admin", "manager", "creator", "reviewer"];

/** Who may open each page. Detail pages ([id]) inherit from their list page unless noted. */
export const PAGE_ROLES: Record<PageKey, readonly Role[]> = {
  dashboard: ALL,
  submissions: ALL,
  "submissions/new": ["creator"], // DataBasePRD matrix: only creators create submissions
  reviews: ["manager", "reviewer"],
  campaigns: ["admin", "manager"],
  knowledge: ALL,
  embargoes: ["admin", "manager"],
  analytics: ["admin", "manager"],
  users: ["admin"],
  agent: ["admin"],
  settings: ["admin"],
  audit: ["admin"],
  notifications: ALL,
};

export interface NavItem {
  label: string;
  page: PageKey;
  icon: NavIcon;
  /** Shown but not clickable (designPRD: Integrations is future). */
  disabled?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// designPRD 2.3 sidebar groups.
const GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", page: "dashboard", icon: "dashboard" },
      { label: "Submissions", page: "submissions", icon: "file" },
      { label: "Reviews", page: "reviews", icon: "check" },
      { label: "Campaigns", page: "campaigns", icon: "layers" },
      { label: "Knowledge Base", page: "knowledge", icon: "book" },
      { label: "Embargoes", page: "embargoes", icon: "lock" },
      { label: "Analytics", page: "analytics", icon: "chart" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Users & Roles", page: "users", icon: "users" },
      { label: "AI Agent Settings", page: "agent", icon: "bot" },
      { label: "Integrations", page: "settings", icon: "plug", disabled: true },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", page: "settings", icon: "settings" },
      { label: "Audit Log", page: "audit", icon: "history" },
      { label: "Notifications", page: "notifications", icon: "bell" },
    ],
  },
];

/** The sidebar for one role: only pages that role can open, empty groups dropped. */
export function navFor(role: Role): NavGroup[] {
  return GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.disabled || PAGE_ROLES[i.page].includes(role)),
  })).filter((g) => g.items.some((i) => !i.disabled));
}

export function orgPath(orgId: string, page: PageKey | string = "dashboard"): string {
  return `/org/${orgId}/${page}`;
}

export function activeMembership(user: User, orgId: string): Membership | undefined {
  return user.memberships.find((m) => m.orgId === orgId && m.status === "active");
}

/** Where someone lands after login: the dashboard of their first active company. */
export function homeFor(user: User): string {
  const first = user.memberships.find((m) => m.status === "active");
  return first ? orgPath(first.orgId) : "/login";
}
