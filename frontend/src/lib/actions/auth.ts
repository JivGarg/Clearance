"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvitations } from "@/lib/data/mutations";
import { DEMO_PASSWORD } from "@/lib/demo-users";
import { activeMembership, homeFor, orgPath } from "@/lib/roles";
import { SESSION_COOKIE, demoAuthEnabled, findUserIdByEmail, getSessionUser, loadUser } from "@/lib/session";

/** Demo auth actions. Replace with Supabase Auth when credentials exist (see lib/session.ts). */

export interface LoginState {
  error?: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
} as const;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!demoAuthEnabled()) return { error: "Demo sign-in is disabled on this deployment." };
  if (!email || !password) return { error: "Enter your email and password." };

  const userId = findUserIdByEmail(email);
  // Same message for unknown email and wrong password.
  if (!userId || password !== DEMO_PASSWORD) return { error: "Email or password is incorrect." };

  // Demo stand-in for accepting an invitation (designPRD 4.1): first sign-in activates it.
  acceptInvitations(userId);
  const user = loadUser(userId);
  if (!user || !user.memberships.some((m) => m.status === "active")) {
    return { error: "This account has no active access to any company. Ask your admin." };
  }

  (await cookies()).set(SESSION_COOKIE, user.id, COOKIE_OPTIONS);
  redirect(homeFor(user));
}

/** Demo account switcher: only an existing session may switch. */
export async function switchUserAction(formData: FormData): Promise<void> {
  if (!(await getSessionUser())) redirect("/login");
  const target = loadUser(String(formData.get("userId") ?? ""));
  if (!target || !target.memberships.some((m) => m.status === "active")) return;
  (await cookies()).set(SESSION_COOKIE, target.id, COOKIE_OPTIONS);
  redirect(homeFor(target));
}

/** Company switcher for people who belong to more than one company. */
export async function switchOrgAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const orgId = String(formData.get("orgId") ?? "");
  redirect(activeMembership(user, orgId) ? orgPath(orgId) : homeFor(user));
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
