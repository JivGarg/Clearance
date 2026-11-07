"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions/types";
import { orgSettings, type Actor } from "@/lib/data/queries";
import { fromLocalInput } from "@/lib/format";
import * as m from "@/lib/data/mutations";
import type { Role } from "@/lib/domain";
import { actorFor, getSessionUser } from "@/lib/session";

/**
 * Server actions for the admin screens. Each re-checks the session and role server-side (never
 * trust the UI), then calls a rule-enforcing mutation. Rule errors come back as messages.
 */

/**
 * Re-render every company page after a write. Verified: with cacheComponents + partialPrefetching,
 * refresh() returned the fresh tree but the open page did not update; revalidatePath on the
 * layout does. The shell (bell, company name) is in that layout, so it updates too.
 */
function rerender() {
  revalidatePath("/org/[orgId]", "layout");
}

const ADMIN: readonly Role[] = ["admin"];
const STAFF: readonly Role[] = ["admin", "manager"];

async function run(fd: FormData, roles: readonly Role[], fn: (a: Actor, get: (k: string) => string) => string): Promise<ActionState> {
  const at = Date.now();
  const orgId = String(fd.get("orgId") ?? "");
  const actor = await actorFor(orgId, roles);
  if (!actor) return { ok: false, error: "You don't have permission to do this.", at };
  try {
    const message = fn(actor, (k) => String(fd.get(k) ?? ""));
    rerender();
    return { ok: true, message, at };
  } catch (e) {
    if (e instanceof m.RuleError) return { ok: false, error: e.message, at };
    throw e;
  }
}

export async function inviteMemberAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.inviteMember(a, { name: g("name"), email: g("email"), role: g("role") }));
}
export async function changeRoleAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.changeMemberRole(a, g("membershipId"), g("role")));
}
export async function setMemberStatusAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.setMemberStatus(a, g("membershipId"), g("status")));
}

export async function saveGuidelineAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.saveGuideline(a, { id: g("id") || undefined, rule: g("rule"), category: g("category") }));
}
/** Form dates are typed in the company's timezone; convert to UTC ISO ("invalid" fails validation). */
function zoned(orgId: string, value: string, endOfDay = false): string {
  if (!value) return "";
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  return fromLocalInput(endOfDay ? `${value}T23:59` : value, tz) ?? "invalid";
}

export async function saveFactAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) =>
    m.saveFact(a, {
      id: g("id") || undefined,
      fact: g("fact"),
      source: g("source"),
      validUntil: zoned(a.orgId, g("validUntil"), true),
      level: g("level"),
    }),
  );
}
export async function expireFactAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.expireFact(a, g("id")));
}
export async function saveAssetAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) =>
    m.saveAsset(a, { id: g("id") || undefined, fileName: g("fileName"), assetType: g("assetType"), visibility: g("visibility") }),
  );
}

export async function saveEmbargoAction(_p: ActionState, fd: FormData) {
  return run(fd, STAFF, (a, g) =>
    m.saveEmbargo(a, { id: g("id") || undefined, item: g("item"), releaseAt: zoned(a.orgId, g("releaseAt")), visibility: g("visibility") }),
  );
}
export async function releaseEmbargoAction(_p: ActionState, fd: FormData) {
  return run(fd, STAFF, (a, g) => m.releaseEmbargo(a, g("id")));
}

export async function saveCampaignAction(_p: ActionState, fd: FormData) {
  return run(fd, STAFF, (a, g) =>
    m.saveCampaign(a, { id: g("id") || undefined, name: g("name"), startDate: g("startDate"), endDate: g("endDate") }),
  );
}

export async function releaseSubmissionAction(_p: ActionState, fd: FormData) {
  return run(fd, STAFF, (a, g) => m.releaseSubmission(a, g("id")));
}

export async function saveAgentSettingsAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) =>
    m.saveAgentSettings(a, {
      lowRisk: g("lowRisk"),
      mediumRisk: g("mediumRisk"),
      maxCheckAttempts: g("maxCheckAttempts"),
      reviewDeadlineHours: g("reviewDeadlineHours"),
    }),
  );
}
export async function saveOrgSettingsAction(_p: ActionState, fd: FormData) {
  return run(fd, ADMIN, (a, g) => m.saveOrgSettings(a, { companyName: g("companyName"), timezone: g("timezone") }));
}

/** Notifications belong to the person, not the company: no org check, own rows only. */
export async function markNotificationReadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in again.", at: Date.now() };
  const id = String(fd.get("id") ?? "");
  if (id === "all") {
    const n = m.markAllNotificationsRead(user.id);
    rerender();
    return { ok: true, message: n ? `Marked ${n} as read.` : "Nothing unread.", at: Date.now() };
  }
  m.markNotificationRead(user.id, id);
  rerender();
  return { ok: true, at: Date.now() };
}
