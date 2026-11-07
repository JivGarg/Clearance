import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findDemoUserById } from "@/lib/demo-users";
import type { Membership, Role, User } from "@/lib/domain";
import { activeMembership, homeFor, orgPath } from "@/lib/roles";

/**
 * SESSION SEAM
 * ------------
 * Demo session: an httpOnly cookie holding one seeded user id. NOT secure (the cookie can be
 * forged); it exists so screens can be built before Supabase Auth is wired. To go real, replace
 * getSessionUser() with Supabase (auth.getUser + users/org_memberships lookup); callers stay.
 * Production builds refuse the demo session unless ALLOW_DEMO_AUTH=true.
 */

export const SESSION_COOKIE = "clearance_demo_user";

export function demoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH === "true";
}

/**
 * Reads request cookies, so call it only inside <Suspense>.
 * ORDER MATTERS: read the cookie first, unconditionally. An early return before cookies() makes
 * the guard static and Next freezes a redirect into the build for every visitor.
 */
export async function getSessionUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!demoAuthEnabled()) return null;
  if (!id) return null;
  return findDemoUserById(id) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export interface OrgContext {
  user: User;
  membership: Membership;
}

/**
 * Guard for a company-scoped page. No active membership in that company: back to the user's own
 * home (never reveal whether the company exists). Wrong role: back to that company's dashboard.
 */
export async function requireOrg(orgId: string, roles?: readonly Role[]): Promise<OrgContext> {
  const user = await requireUser();
  const membership = activeMembership(user, orgId);
  if (!membership) redirect(homeFor(user));
  if (roles && !roles.includes(membership.role)) redirect(orgPath(orgId));
  return { user, membership };
}
