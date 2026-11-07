import "server-only";
import { ROLES, type Role, type VisibilityClass } from "@/lib/domain";
import { db, newId, nowIso } from "@/lib/data/store";
import { hasActiveEmbargo, isStaff, type Actor } from "@/lib/data/queries";
import type { AgentSettingsRow, LowAutonomy, MediumAutonomy, SourceType } from "@/lib/data/types";

/**
 * Writes, each enforcing the same rules as the database (access matrix in ..03_rls.sql, triggers
 * in ..02_rules.sql). A broken rule throws RuleError with a message safe to show the user.
 * Admin changes are recorded in adminEvents (demo store only; no audit table in the schema yet).
 */

export class RuleError extends Error {}

const VISIBILITY: readonly VisibilityClass[] = ["public_to_creators", "internal", "confidential", "local_only"];

function allow(a: Actor, roles: readonly Role[], what: string) {
  if (!roles.includes(a.role)) throw new RuleError(`Your role cannot ${what}.`);
}

function text(value: string | undefined, label: string, { max = 500, required = true } = {}): string {
  const v = (value ?? "").trim();
  if (required && !v) throw new RuleError(`${label} is required.`);
  if (v.length > max) throw new RuleError(`${label} must be ${max} characters or fewer.`);
  return v;
}

function visibility(value: string | undefined): VisibilityClass {
  if (!VISIBILITY.includes(value as VisibilityClass)) throw new RuleError("Choose a visibility class.");
  return value as VisibilityClass;
}

/** "" -> null; otherwise a valid date (YYYY-MM-DD) or datetime. */
function optionalDate(value: string | undefined, label: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new RuleError(`${label} is not a valid date.`);
  return v;
}

function logAdmin(a: Actor, action: string, detail: string) {
  db().adminEvents.push({ eventId: newId(), organizationId: a.orgId, actorUserId: a.userId, action, detail, createdAt: nowIso() });
}

function notify(userId: string, message: string, submissionId: string | null = null) {
  db().notifications.push({ notificationId: newId(), recipientUserId: userId, submissionId, message, readAt: null, createdAt: nowIso() });
}

// ------------------------------------------------------------------------ members

function findMembership(a: Actor, membershipId: string) {
  const m = db().memberships.find((x) => x.membershipId === membershipId && x.organizationId === a.orgId);
  if (!m) throw new RuleError("That member was not found.");
  return m;
}

function activeAdmins(orgId: string) {
  return db().memberships.filter((m) => m.organizationId === orgId && m.role === "admin" && m.status === "active");
}

function openReviews(orgId: string, userId: string) {
  const d = db();
  return d.assignments.filter(
    (x) =>
      x.reviewerUserId === userId &&
      x.status !== "done" &&
      d.submissions.some((s) => s.submissionId === x.submissionId && s.organizationId === orgId),
  ).length;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function inviteMember(a: Actor, input: { name?: string; email?: string; role?: string }): string {
  allow(a, ["admin"], "invite members");
  const name = text(input.name, "Name", { max: 120 });
  const email = text(input.email, "Email", { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) throw new RuleError("Enter a valid email address.");
  if (!ROLES.includes(input.role as Role)) throw new RuleError("Choose a role.");
  const role = input.role as Role;

  const d = db();
  let user = d.users.find((x) => x.email === email);
  if (user && d.memberships.some((m) => m.userId === user!.userId && m.organizationId === a.orgId)) {
    throw new RuleError("This person already has a membership in this company. Change it in the table instead.");
  }
  if (!user) {
    user = { userId: newId(), name, email, createdAt: nowIso() };
    d.users.push(user);
  }
  const now = nowIso();
  d.memberships.push({ membershipId: newId(), organizationId: a.orgId, userId: user.userId, role, status: "invited", createdAt: now, updatedAt: now });
  logAdmin(a, "Invited member", `${email} as ${role}`);
  return `Invitation recorded for ${email}.`;
}

export function changeMemberRole(a: Actor, membershipId: string, role: string): string {
  allow(a, ["admin"], "change roles");
  if (!ROLES.includes(role as Role)) throw new RuleError("Choose a role.");
  const m = findMembership(a, membershipId);
  if (m.userId === a.userId) throw new RuleError("You cannot change your own role. Ask another admin.");
  if (m.role === role) return "No change.";
  if (m.role === "admin" && m.status === "active" && activeAdmins(a.orgId).length <= 1) {
    throw new RuleError("A company needs at least one active admin.");
  }
  const before = m.role;
  m.role = role as Role;
  m.updatedAt = nowIso();
  const email = db().users.find((x) => x.userId === m.userId)?.email ?? "member";
  logAdmin(a, "Changed role", `${email}: ${before} to ${role}`);
  const open = before === "reviewer" ? openReviews(a.orgId, m.userId) : 0;
  return open ? `Role changed. ${open} open review(s) need a new reviewer; a manager can reassign them.` : "Role changed.";
}

export function setMemberStatus(a: Actor, membershipId: string, status: string): string {
  allow(a, ["admin"], "suspend or restore members");
  if (status !== "active" && status !== "suspended") throw new RuleError("Unknown status.");
  const m = findMembership(a, membershipId);
  if (m.userId === a.userId) throw new RuleError("You cannot suspend yourself.");
  if (m.status === status) return "No change.";
  if (status === "suspended" && m.role === "admin" && m.status === "active" && activeAdmins(a.orgId).length <= 1) {
    throw new RuleError("A company needs at least one active admin.");
  }
  if (status === "active" && m.status === "invited") {
    throw new RuleError("Invited people become active when they accept the invitation.");
  }
  const before = m.status;
  m.status = status;
  m.updatedAt = nowIso();
  const email = db().users.find((x) => x.userId === m.userId)?.email ?? "member";
  logAdmin(a, status === "suspended" ? (before === "invited" ? "Revoked invitation" : "Suspended member") : "Restored member", email);
  if (status === "active") return "Access restored.";
  const open = m.role === "reviewer" ? openReviews(a.orgId, m.userId) : 0;
  return open
    ? `Access revoked. Their history stays attributed. ${open} open review(s) need a new reviewer.`
    : "Access revoked. Their history stays attributed to them.";
}

/** Demo stand-in for invite acceptance: an invited person signing in becomes active. */
export function acceptInvitations(userId: string) {
  for (const m of db().memberships) {
    if (m.userId === userId && m.status === "invited") {
      m.status = "active";
      m.updatedAt = nowIso();
    }
  }
}

// ---------------------------------------------------------------------- knowledge

export function saveGuideline(a: Actor, input: { id?: string; rule?: string; category?: string }): string {
  allow(a, ["admin"], "edit guidelines");
  const rule = text(input.rule, "Rule", { max: 1000 });
  const category = text(input.category, "Category", { max: 60 }).toLowerCase();
  const d = db();
  const now = nowIso();
  if (!input.id) {
    d.guidelines.push({ guidelineId: newId(), organizationId: a.orgId, rule, category, version: 1, createdAt: now, updatedAt: now });
    logAdmin(a, "Added guideline", `${category}: ${rule}`);
    return "Guideline added as version 1.";
  }
  const g = d.guidelines.find((x) => x.guidelineId === input.id && x.organizationId === a.orgId);
  if (!g) throw new RuleError("That guideline was not found.");
  if (g.rule === rule && g.category === category) return "No change.";
  const ruleChanged = g.rule !== rule;
  g.rule = rule;
  g.category = category;
  if (ruleChanged) g.version += 1;
  g.updatedAt = now;
  logAdmin(a, "Edited guideline", `${category} v${g.version}: ${rule}`);
  return ruleChanged ? `Saved as version ${g.version}. Earlier findings keep citing the version they were checked against.` : "Category updated.";
}

/** designPRD 4.2: a changed fact alerts the owners of pending submissions that cite it. */
function alertPendingCiting(sourceType: SourceType, sourceId: string): number {
  const d = db();
  const owners = new Map<string, string>();
  for (const i of d.issues.filter((x) => x.sourceType === sourceType && x.sourceId === sourceId)) {
    const c = d.checks.find((x) => x.checkId === i.checkId);
    const s = d.submissions.find((x) => x.submissionId === c?.submissionId);
    if (s && (s.status === "in_review" || s.status === "changes_requested" || s.status === "draft")) owners.set(s.submissionId, s.createdByUserId);
  }
  for (const [sid, uid] of owners) notify(uid, "An approved fact used to check your submission has changed. It will be checked again.", sid);
  return owners.size;
}

export function saveFact(a: Actor, input: { id?: string; fact?: string; source?: string; validUntil?: string; level?: string }): string {
  allow(a, ["admin"], "edit facts");
  const fact = text(input.fact, "Fact", { max: 1000 });
  const source = text(input.source, "Source", { max: 200 });
  const validUntil = optionalDate(input.validUntil, "Valid until");
  const level = visibility(input.level);
  const d = db();
  const now = nowIso();
  const iso = validUntil ? new Date(validUntil).toISOString() : null;
  if (!input.id) {
    if (iso && Date.parse(iso) <= Date.now()) throw new RuleError("A new fact cannot already be expired.");
    d.facts.push({ factId: newId(), organizationId: a.orgId, fact, source, validUntil: iso, confidentialityLevel: level, createdAt: now, updatedAt: now });
    logAdmin(a, "Added fact", fact);
    return "Fact added.";
  }
  const f = d.facts.find((x) => x.factId === input.id && x.organizationId === a.orgId);
  if (!f) throw new RuleError("That fact was not found.");
  Object.assign(f, { fact, source, validUntil: iso, confidentialityLevel: level, updatedAt: now });
  logAdmin(a, "Edited fact", fact);
  const alerted = alertPendingCiting("fact", f.factId);
  return alerted ? `Fact saved. ${alerted} pending submission owner(s) were alerted.` : "Fact saved.";
}

export function expireFact(a: Actor, id: string): string {
  allow(a, ["admin"], "expire facts");
  const f = db().facts.find((x) => x.factId === id && x.organizationId === a.orgId);
  if (!f) throw new RuleError("That fact was not found.");
  if (f.validUntil && Date.parse(f.validUntil) <= Date.now()) return "Already expired.";
  f.validUntil = nowIso();
  f.updatedAt = f.validUntil;
  logAdmin(a, "Expired fact", f.fact);
  alertPendingCiting("fact", f.factId);
  return "Fact expired. Checks no longer use it.";
}

const ASSET_TYPES = ["logo", "image", "document", "video", "font", "other"];

export function saveAsset(a: Actor, input: { id?: string; fileName?: string; assetType?: string; visibility?: string }): string {
  allow(a, ["admin"], "edit assets");
  const assetType = input.assetType ?? "";
  if (!ASSET_TYPES.includes(assetType)) throw new RuleError("Choose an asset type.");
  const vis = visibility(input.visibility);
  const d = db();
  const now = nowIso();
  if (!input.id) {
    const fileName = text(input.fileName, "File name", { max: 120 });
    if (!/^[\w.-]+\.[a-z0-9]{2,5}$/i.test(fileName)) throw new RuleError("Use a file name like logo-2026.svg (letters, numbers, dots, dashes).");
    const slug = (d.organizations.find((o) => o.organizationId === a.orgId)?.companyName ?? "org").toLowerCase().replace(/[^a-z0-9]+/g, "");
    d.assets.push({ assetId: newId(), organizationId: a.orgId, storagePath: `assets/${slug}/${fileName}`, assetType, visibility: vis, createdAt: now, updatedAt: now });
    logAdmin(a, "Added asset", fileName);
    return "Asset recorded. File upload arrives with Supabase Storage.";
  }
  const x = d.assets.find((r) => r.assetId === input.id && r.organizationId === a.orgId);
  if (!x) throw new RuleError("That asset was not found.");
  Object.assign(x, { assetType, visibility: vis, updatedAt: now });
  logAdmin(a, "Edited asset", `${x.storagePath}: ${assetType}, ${vis}`);
  return "Asset saved.";
}

// ---------------------------------------------------------------------- embargoes

export function saveEmbargo(a: Actor, input: { id?: string; item?: string; releaseAt?: string; visibility?: string }): string {
  allow(a, ["admin", "manager"], "edit embargoes");
  const item = text(input.item, "Restricted item", { max: 200 });
  const release = optionalDate(input.releaseAt, "Release time");
  if (!release) throw new RuleError("Release time is required.");
  const vis = visibility(input.visibility);
  const iso = new Date(release).toISOString();
  const d = db();
  const now = nowIso();
  if (!input.id) {
    if (Date.parse(iso) <= Date.now()) throw new RuleError("A new embargo needs a release time in the future.");
    d.embargoes.push({ embargoId: newId(), organizationId: a.orgId, restrictedItem: item, releaseAt: iso, visibility: vis, createdAt: now, updatedAt: now });
    logAdmin(a, "Added embargo", `${item} until ${iso}`);
    return "Embargo added.";
  }
  const e = d.embargoes.find((x) => x.embargoId === input.id && x.organizationId === a.orgId);
  if (!e) throw new RuleError("That embargo was not found.");
  Object.assign(e, { restrictedItem: item, releaseAt: iso, visibility: vis, updatedAt: now });
  logAdmin(a, "Edited embargo", `${item} until ${iso}`);
  return "Embargo saved.";
}

/** designPRD 4.9: lifting an embargo never approves anything; held work stays in review. */
export function releaseEmbargo(a: Actor, id: string): string {
  allow(a, ["admin", "manager"], "lift embargoes");
  const e = db().embargoes.find((x) => x.embargoId === id && x.organizationId === a.orgId);
  if (!e) throw new RuleError("That embargo was not found.");
  if (Date.parse(e.releaseAt) <= Date.now()) return "Already released.";
  e.releaseAt = nowIso();
  e.updatedAt = e.releaseAt;
  logAdmin(a, "Lifted embargo", e.restrictedItem);
  return "Embargo lifted. Held submissions stay in review until a reviewer decides.";
}

// ---------------------------------------------------------------------- campaigns

export function saveCampaign(a: Actor, input: { id?: string; name?: string; startDate?: string; endDate?: string }): string {
  allow(a, ["admin", "manager"], "edit campaigns");
  const name = text(input.name, "Campaign name", { max: 120 });
  const start = optionalDate(input.startDate, "Start date");
  const end = optionalDate(input.endDate, "End date");
  if (start && end && end < start) throw new RuleError("End date must be on or after the start date.");
  const d = db();
  const now = nowIso();
  if (d.campaigns.some((c) => c.organizationId === a.orgId && c.campaignName.toLowerCase() === name.toLowerCase() && c.campaignId !== input.id)) {
    throw new RuleError("A campaign with this name already exists.");
  }
  if (!input.id) {
    d.campaigns.push({ campaignId: newId(), organizationId: a.orgId, campaignName: name, startDate: start, endDate: end, createdAt: now, updatedAt: now });
    logAdmin(a, "Added campaign", name);
    return "Campaign added.";
  }
  const c = d.campaigns.find((x) => x.campaignId === input.id && x.organizationId === a.orgId);
  if (!c) throw new RuleError("That campaign was not found.");
  Object.assign(c, { campaignName: name, startDate: start, endDate: end, updatedAt: now });
  logAdmin(a, "Edited campaign", name);
  return "Campaign saved.";
}

// ---------------------------------------------------------------------- submissions

/** enforce_submission_update: admin/manager may only do approved -> released, never with an active embargo. */
export function releaseSubmission(a: Actor, id: string): string {
  if (!isStaff(a)) throw new RuleError("Your role cannot release content.");
  const s = db().submissions.find((x) => x.submissionId === id && x.organizationId === a.orgId);
  if (!s) throw new RuleError("That submission was not found.");
  if (s.status !== "approved") throw new RuleError("Only approved content can be released.");
  if (hasActiveEmbargo(id)) throw new RuleError("This submission cites an active embargo and cannot be released.");
  s.status = "released";
  s.updatedAt = nowIso();
  notify(s.createdByUserId, "Your approved submission was marked as released.", id);
  if (a.role === "admin") logAdmin(a, "Released submission", s.intentSummary ?? id);
  return "Marked as released.";
}

// ---------------------------------------------------------------------- settings

const LOW: readonly LowAutonomy[] = ["auto_fix", "ask_first", "recommend_only"];
const MEDIUM: readonly MediumAutonomy[] = ["ask_first", "recommend_only"];

export function saveAgentSettings(a: Actor, input: { lowRisk?: string; mediumRisk?: string; maxCheckAttempts?: string; reviewDeadlineHours?: string }): string {
  allow(a, ["admin"], "change agent settings");
  if (!LOW.includes(input.lowRisk as LowAutonomy)) throw new RuleError("Choose how the agent handles low-risk findings.");
  if (!MEDIUM.includes(input.mediumRisk as MediumAutonomy)) {
    throw new RuleError("Medium-risk fixes always need a person to approve them; auto-fix is not allowed.");
  }
  const attempts = Number(input.maxCheckAttempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new RuleError("Check attempts must be a whole number from 1 to 10.");
  const hours = Number(input.reviewDeadlineHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 336) throw new RuleError("Review deadline must be 1 to 336 hours.");
  const row = db().agentSettings.find((x) => x.organizationId === a.orgId);
  const next: AgentSettingsRow = {
    organizationId: a.orgId,
    lowRisk: input.lowRisk as LowAutonomy,
    mediumRisk: input.mediumRisk as MediumAutonomy,
    maxCheckAttempts: attempts,
    reviewDeadlineHours: hours,
    updatedAt: nowIso(),
  };
  if (row) Object.assign(row, next);
  else db().agentSettings.push(next);
  logAdmin(a, "Changed agent settings", `low: ${next.lowRisk}, medium: ${next.mediumRisk}, attempts: ${attempts}, deadline: ${hours}h`);
  return "Agent settings saved.";
}

export function saveOrgSettings(a: Actor, input: { companyName?: string; timezone?: string }): string {
  allow(a, ["admin"], "change company settings");
  const name = text(input.companyName, "Company name", { max: 120 });
  const tz = text(input.timezone, "Timezone", { max: 64 });
  if (!Intl.supportedValuesOf("timeZone").includes(tz) && tz !== "UTC") throw new RuleError("Choose a timezone from the list.");
  const d = db();
  const org = d.organizations.find((o) => o.organizationId === a.orgId);
  if (!org) throw new RuleError("Company not found.");
  const changes: string[] = [];
  if (org.companyName !== name) {
    changes.push(`name "${org.companyName}" to "${name}"`);
    org.companyName = name;
    org.updatedAt = nowIso();
  }
  const settings = d.orgSettings.find((o) => o.organizationId === a.orgId);
  if (settings && settings.timezone !== tz) {
    changes.push(`timezone ${settings.timezone} to ${tz}`);
    settings.timezone = tz;
  } else if (!settings) d.orgSettings.push({ organizationId: a.orgId, timezone: tz });
  if (!changes.length) return "No change.";
  logAdmin(a, "Changed company settings", changes.join("; "));
  return "Settings saved.";
}

// ---------------------------------------------------------------------- notifications

export function markNotificationRead(userId: string, id: string) {
  const n = db().notifications.find((x) => x.notificationId === id && x.recipientUserId === userId);
  if (n && !n.readAt) n.readAt = nowIso();
}

export function markAllNotificationsRead(userId: string): number {
  let count = 0;
  for (const n of db().notifications) {
    if (n.recipientUserId === userId && !n.readAt) {
      n.readAt = nowIso();
      count++;
    }
  }
  return count;
}
