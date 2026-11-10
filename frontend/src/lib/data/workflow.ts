import "server-only";
import { runCheckService, type ServiceIssue } from "@/lib/check-service";
import { CHANNELS, type Channel, type Risk } from "@/lib/domain";
import { RuleError } from "@/lib/data/mutations";
import { agentSettings, hasActiveEmbargo, isActiveEmbargo, isCurrentFact, latestRevision, type Actor } from "@/lib/data/queries";
import { db, newId, nowIso } from "@/lib/data/store";
import type { AssignmentRow, DecisionKind, Intent, IssueRow, SourceType, SubmissionRow } from "@/lib/data/types";

/**
 * The submission workflow: create, check, revise, apply fixes, send for review, assign, decide.
 * Each step enforces the same rules as the database (..02_rules.sql: enforce_submission_update,
 * before_revision_insert, check_assignment, before/after_decision_insert) so moving to Supabase
 * changes where the rule runs, not what it says.
 */

const RANK: Record<Risk, number> = { low: 1, medium: 2, high: 3 };
const MAX_CONTENT = 5000;

function notify(userId: string, message: string, submissionId: string | null) {
  db().notifications.push({ notificationId: newId(), recipientUserId: userId, submissionId, message, readAt: null, createdAt: nowIso() });
}

function logAgent(submissionId: string, action: string, reason: string, undoData: Record<string, unknown> | null = null) {
  db().agentActions.push({ actionId: newId(), submissionId, action, reason, undoData, createdAt: nowIso() });
}

function staff(orgId: string, roles: string[]) {
  return db().memberships.filter((m) => m.organizationId === orgId && m.status === "active" && roles.includes(m.role));
}

function ownSubmission(a: Actor, id: string): SubmissionRow {
  const s = db().submissions.find((x) => x.submissionId === id && x.organizationId === a.orgId);
  if (!s || s.createdByUserId !== a.userId || a.role !== "creator") throw new RuleError("That submission was not found.");
  return s;
}

function addRevision(s: SubmissionRow, userId: string, content: string, summary: string) {
  if (s.status === "rejected" || s.status === "released") throw new RuleError("Rejected or released content is final. Start a new submission instead.");
  const d = db();
  const version = (latestRevision(s.submissionId)?.version ?? 0) + 1;
  const ext = s.contentPath.split(".").pop() ?? "txt";
  const path = `submissions/${s.submissionId}/v${version}.${ext}`;
  d.revisions.push({ revisionId: newId(), submissionId: s.submissionId, editedByUserId: userId, version, contentPath: path, changeSummary: summary, content, createdAt: nowIso() });
  s.contentPath = path;
  s.updatedAt = nowIso();
  // Stale approval (designPRD 4.8, A11): changed content goes back to review.
  if (s.status === "approved") {
    s.status = "in_review";
    autoAssign(s, "Approved content was changed, so it needs a new review.");
  }
  return version;
}

// ------------------------------------------------------------------ source linking

/** Each mock rule cites a kind of source; find that company's actual row (current facts, active embargoes). */
const RULE_SOURCES: Record<string, { type: SourceType; match: RegExp }> = {
  "product-name": { type: "guideline", match: /Sonic X1/i },
  "banned-word": { type: "guideline", match: /cheap/i },
  hashtag: { type: "guideline", match: /#SummerSound/i },
  "alt-text": { type: "guideline", match: /alt text/i },
  tone: { type: "guideline", match: /hyped|brand voice/i },
  logo: { type: "asset", match: /logo-2026/i },
  "battery-claim": { type: "fact", match: /battery/i },
  "health-claim": { type: "guideline", match: /health/i },
  "discount-mismatch": { type: "fact", match: /discount/i },
  "ad-disclosure": { type: "guideline", match: /#ad/i },
  embargo: { type: "embargo", match: /Nova/i },
};

function resolveSource(orgId: string, issue: ServiceIssue): { type: SourceType; id: string } | null {
  const spec = issue.rule ? RULE_SOURCES[issue.rule] : undefined;
  if (!spec) return null;
  const d = db();
  const now = Date.now();
  switch (spec.type) {
    case "guideline": {
      const g = d.guidelines.find((x) => x.organizationId === orgId && spec.match.test(x.rule));
      return g ? { type: "guideline", id: g.guidelineId } : null;
    }
    case "fact": {
      const f = d.facts.find((x) => x.organizationId === orgId && isCurrentFact(x, now) && spec.match.test(x.fact));
      return f ? { type: "fact", id: f.factId } : null;
    }
    case "asset": {
      const x = d.assets.find((r) => r.organizationId === orgId && spec.match.test(r.storagePath));
      return x ? { type: "asset", id: x.assetId } : null;
    }
    case "embargo": {
      const e = d.embargoes.find((r) => r.organizationId === orgId && isActiveEmbargo(r, now) && spec.match.test(r.restrictedItem));
      return e ? { type: "embargo", id: e.embargoId } : null;
    }
  }
}

// ------------------------------------------------------------------ fixes

interface Fix {
  start: number;
  end: number;
  replacement: string;
  rule?: string;
  label: string;
}

/** Apply fixes right to left so earlier offsets stay valid; overlapping fixes are skipped. */
export function applyFixesToText(text: string, fixes: Fix[]): { text: string; applied: Fix[] } {
  const prepend = fixes.filter((f) => f.rule === "ad-disclosure");
  const ranged = fixes.filter((f) => f.rule !== "ad-disclosure").sort((x, y) => y.start - x.start);
  let out = text;
  const applied: Fix[] = [];
  let limit = Infinity;
  for (const f of ranged) {
    if (f.end > limit || f.start < 0 || f.end > text.length || f.start > f.end) continue;
    out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
    applied.push(f);
    limit = f.start;
  }
  if (prepend.length && !/^#ad\b/i.test(out)) {
    out = `#ad ${out}`;
    applied.push(prepend[0]);
  }
  return { text: out, applied };
}

// ------------------------------------------------------------------ checks

export interface CheckOutcome {
  message: string;
}

/**
 * Run the check service on the latest version. Low/medium fixes the admin set to auto-fix are
 * applied as a new version by the agent (logged with undo data), then that version is checked.
 * Attempts per version are capped by the agent settings (designPRD 4.6 loop prevention).
 */
export async function runCheck(a: Actor, submissionId: string): Promise<CheckOutcome> {
  const s = ownSubmission(a, submissionId);
  if (s.status !== "draft" && s.status !== "changes_requested") throw new RuleError("Checks run while the draft is with you, before it is sent for review.");
  const settings = agentSettings(a.orgId);
  const autonomy = { low: settings?.lowRisk ?? "auto_fix", medium: settings?.mediumRisk ?? "ask_first", high: "recommend_only" } as const;
  const maxAttempts = settings?.maxCheckAttempts ?? 3;

  let rev = latestRevision(s.submissionId);
  if (!rev) throw new RuleError("Add content before running a check.");
  const attempts = db().checks.filter((c) => c.revisionId === rev!.revisionId).length;
  if (attempts >= maxAttempts) throw new RuleError(`This version has been checked ${attempts} times, the limit set by your admin. Edit the content to check again.`);

  let result = await runCheckService({ submissionId, channel: s.channel, content: rev.content, autonomy });
  let autoFixed = 0;
  const auto = result.issues.filter((i) => i.state === "applied" && i.location && i.suggested_fix !== null);
  if (auto.length) {
    const { text, applied } = applyFixesToText(
      rev.content,
      auto.map((i) => ({ start: i.location!.start, end: i.location!.end, replacement: i.suggested_fix!, rule: i.rule ?? undefined, label: i.type })),
    );
    if (applied.length && text !== rev.content) {
      autoFixed = applied.length;
      const before = rev.content;
      addRevision(s, s.createdByUserId, text, `Agent applied ${applied.length} low-risk fix(es): ${[...new Set(applied.map((f) => f.label))].join(", ")}`);
      logAgent(s.submissionId, "auto_fix_applied", `Applied ${applied.length} fix(es) allowed by the agent settings`, { before, after: text });
      rev = latestRevision(s.submissionId)!;
      result = await runCheckService({ submissionId, channel: s.channel, content: rev.content, autonomy });
    }
  }

  const d = db();
  const checkId = newId();
  const now = nowIso();
  const issues: IssueRow[] = [];
  let unsourced = 0;
  for (const i of result.issues) {
    const src = resolveSource(a.orgId, i);
    if (!src) {
      unsourced++; // never record a finding without an approved source (designPRD 4.5 guardrail)
      continue;
    }
    issues.push({
      issueId: newId(),
      checkId,
      issueType: i.type,
      // The embargo explanation never names the item (designPRD 4.9).
      explanation: i.rule === "embargo" ? i.explanation : `${i.finding} ${i.explanation}`,
      sourceType: src.type,
      sourceId: src.id,
      riskLevel: i.risk,
      suggestedFix: i.suggested_fix,
      spanStart: i.location?.start,
      spanEnd: i.location?.end,
      rule: i.rule ?? undefined,
      createdAt: now,
    });
  }
  const highest = issues.reduce<Risk>((m, i) => (RANK[i.riskLevel] > RANK[m] ? i.riskLevel : m), "low");
  d.checks.push({
    checkId,
    submissionId: s.submissionId,
    revisionId: rev.revisionId,
    riskLevel: highest,
    checkedAt: now,
    serviceUsed: result.service_used,
    result: { mock: result.mock, summary: result.route.reason },
  });
  d.issues.push(...issues);
  logAgent(s.submissionId, "run_check", `Checked version ${rev.version} with ${result.service_used}`);

  // Proposed intent for the creator to confirm (designPRD 4.3); a confirmed intent is kept.
  if (!s.intentConfirmed) {
    s.intent = { goal: result.intent.goal, audience: result.intent.audience, keyMessage: result.intent.key_message, callToAction: result.intent.call_to_action };
  }
  if (issues.some((i) => i.sourceType === "embargo")) {
    logAgent(s.submissionId, "hold", "Embargoed item found; routed to authorised reviewer");
  }
  // Claims with no single approved answer become questions for an admin (designPRD 4.2).
  for (const q of result.agent_questions) {
    for (const m of staff(a.orgId, ["admin"])) notify(m.userId, `Agent question: ${q}`, s.submissionId);
    logAgent(s.submissionId, "ask_admin", q);
  }

  const parts = [`Check complete: ${issues.length} finding(s)${issues.length ? `, highest ${highest} risk` : ""}.`];
  if (autoFixed) parts.push(`The agent applied ${autoFixed} low-risk fix(es) as a new version.`);
  if (unsourced) parts.push(`${unsourced} possible issue(s) had no approved source in this company and were not recorded.`);
  return { message: parts.join(" ") };
}

// ------------------------------------------------------------------ creator steps

export async function createSubmission(a: Actor, input: { content?: string; channel?: string; campaignId?: string }): Promise<{ id: string; message: string }> {
  if (a.role !== "creator") throw new RuleError("Only creators create submissions.");
  const content = (input.content ?? "").trim();
  if (!content) throw new RuleError("Write or paste the text to check.");
  if (content.length > MAX_CONTENT) throw new RuleError(`Text must be ${MAX_CONTENT} characters or fewer.`);
  if (!CHANNELS.includes(input.channel as Channel)) throw new RuleError("Choose a channel.");
  const d = db();
  const campaignId = input.campaignId || null;
  if (campaignId && !d.campaigns.some((c) => c.campaignId === campaignId && c.organizationId === a.orgId)) throw new RuleError("Choose a campaign from this company.");
  const id = newId();
  const now = nowIso();
  const s: SubmissionRow = {
    submissionId: id,
    organizationId: a.orgId,
    campaignId,
    createdByUserId: a.userId,
    contentPath: `submissions/${id}/v0.txt`,
    type: "text",
    channel: input.channel as Channel,
    status: "draft",
    intentSummary: content.length > 80 ? `${content.slice(0, 77).trimEnd()}…` : content,
    intent: null,
    intentConfirmed: false,
    createdAt: now,
    updatedAt: now,
  };
  d.submissions.push(s);
  addRevision(s, a.userId, content, "First version");
  try {
    const outcome = await runCheck(a, id);
    return { id, message: outcome.message };
  } catch (e) {
    // The draft is kept even if the check service is down; the page offers a retry.
    if (e instanceof Error) return { id, message: `Draft saved. ${e.message}` };
    throw e;
  }
}

export function confirmIntent(a: Actor, id: string, input: Partial<Record<keyof Intent, string>>): string {
  const s = ownSubmission(a, id);
  if (s.status !== "draft" && s.status !== "changes_requested") throw new RuleError("The intent can be changed only while the draft is with you.");
  const field = (k: keyof Intent, label: string, max: number) => {
    const v = (input[k] ?? "").trim();
    if (!v) throw new RuleError(`${label} is required.`);
    if (v.length > max) throw new RuleError(`${label} must be ${max} characters or fewer.`);
    return v;
  };
  s.intent = {
    goal: field("goal", "Goal", 200),
    audience: field("audience", "Audience", 200),
    keyMessage: field("keyMessage", "Key message", 300),
    callToAction: field("callToAction", "Call to action", 200),
  };
  s.intentConfirmed = true;
  s.intentSummary = s.intent.keyMessage.length > 100 ? `${s.intent.keyMessage.slice(0, 97).trimEnd()}…` : s.intent.keyMessage;
  s.updatedAt = nowIso();
  return "Intent confirmed. Suggested fixes will be checked against it.";
}

export async function reviseContent(a: Actor, id: string, content: string, summary: string): Promise<string> {
  const s = ownSubmission(a, id);
  const text = content.trim();
  if (!text) throw new RuleError("The new version cannot be empty.");
  if (text.length > MAX_CONTENT) throw new RuleError(`Text must be ${MAX_CONTENT} characters or fewer.`);
  if (text === latestRevision(id)?.content) throw new RuleError("Nothing changed from the current version.");
  const wasApproved = s.status === "approved";
  const v = addRevision(s, a.userId, text, summary.trim().slice(0, 200) || "Edited by the creator");
  if (s.status === "draft" || s.status === "changes_requested") {
    try {
      return `Saved as version ${v}. ${(await runCheck(a, id)).message}`;
    } catch (e) {
      if (e instanceof RuleError || e instanceof Error) return `Saved as version ${v}. ${e.message}`;
      throw e;
    }
  }
  return wasApproved ? `Saved as version ${v}. The earlier approval does not cover it, so it is back in review.` : `Saved as version ${v}. The reviewer will see this version.`;
}

/** designPRD 4.7 / A04: apply only the fixes the creator accepted, as a new version, then re-check. */
export async function applySelectedFixes(a: Actor, id: string, issueIds: string[]): Promise<string> {
  const s = ownSubmission(a, id);
  if (s.status !== "draft" && s.status !== "changes_requested") throw new RuleError("Fixes can be applied only while the draft is with you.");
  if (!issueIds.length) throw new RuleError("Select at least one suggested fix to apply.");
  const d = db();
  const rev = latestRevision(id)!;
  const check = d.checks.filter((c) => c.submissionId === id && c.revisionId === rev.revisionId).sort((x, y) => y.checkedAt.localeCompare(x.checkedAt))[0];
  if (!check) throw new RuleError("Run a check on the current version first.");
  const chosen = d.issues.filter((i) => i.checkId === check.checkId && issueIds.includes(i.issueId) && i.suggestedFix !== null && i.spanStart !== undefined && i.spanEnd !== undefined);
  if (chosen.length !== issueIds.length) throw new RuleError("Some selected fixes are out of date. Reload the page and choose again.");
  const { text, applied } = applyFixesToText(
    rev.content,
    chosen.map((i) => ({ start: i.spanStart!, end: i.spanEnd!, replacement: i.suggestedFix!, rule: i.rule, label: i.issueType })),
  );
  if (!applied.length || text === rev.content) throw new RuleError("Those fixes overlap or no longer apply. Edit the text directly instead.");
  const v = addRevision(s, a.userId, text, `Accepted ${applied.length} suggested fix(es): ${[...new Set(applied.map((f) => f.label))].join(", ")}`);
  try {
    return `Applied ${applied.length} fix(es) as version ${v}; other suggestions are unchanged. ${(await runCheck(a, id)).message}`;
  } catch (e) {
    if (e instanceof Error) return `Applied ${applied.length} fix(es) as version ${v}. ${e.message}`;
    throw e;
  }
}

// ------------------------------------------------------------------ review routing

function eligibleReviewers(s: SubmissionRow) {
  return staff(s.organizationId, ["reviewer"]).filter((m) => m.userId !== s.createdByUserId);
}

function openAssignments(submissionId?: string) {
  return db().assignments.filter((x) => x.status !== "done" && (!submissionId || x.submissionId === submissionId));
}

/** designPRD 4.8: auto-assign by eligibility and workload; the previous reviewer keeps continuity. */
function autoAssign(s: SubmissionRow, why: string): string {
  if (openAssignments(s.submissionId).length) return "";
  const pool = eligibleReviewers(s);
  if (!pool.length) {
    for (const m of staff(s.organizationId, ["manager"])) notify(m.userId, "A submission is waiting for a reviewer, but no eligible reviewer is available.", s.submissionId);
    return " No eligible reviewer is available; a manager has been asked to assign one.";
  }
  const previous = db().assignments.filter((x) => x.submissionId === s.submissionId).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
  const load = (uid: string) => openAssignments().filter((x) => x.reviewerUserId === uid).length;
  const pick = pool.find((m) => m.userId === previous?.reviewerUserId) ?? [...pool].sort((x, y) => load(x.userId) - load(y.userId))[0];
  const hours = agentSettings(s.organizationId)?.reviewDeadlineHours ?? 24;
  createAssignment(s, pick.userId, hours);
  logAgent(s.submissionId, "assign_reviewer", `${why} Assigned by workload; due in ${hours} h.`);
  return " A reviewer has been assigned.";
}

function createAssignment(s: SubmissionRow, reviewerUserId: string, hours: number): AssignmentRow {
  const now = nowIso();
  const row: AssignmentRow = {
    assignmentId: newId(),
    submissionId: s.submissionId,
    reviewerUserId,
    deadline: new Date(Date.now() + hours * 3_600_000).toISOString(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  db().assignments.push(row);
  notify(reviewerUserId, hasActiveEmbargo(s.submissionId) ? "Embargo hold needs your review." : "A submission is waiting for your review.", s.submissionId);
  return row;
}

export function sendForReview(a: Actor, id: string): string {
  const s = ownSubmission(a, id);
  if (s.status !== "draft" && s.status !== "changes_requested") throw new RuleError("Only drafts and work with requested changes can be sent for review.");
  const rev = latestRevision(id);
  if (!rev) throw new RuleError("Add content first.");
  if (!s.intentConfirmed) throw new RuleError("Confirm the intent first, so reviewers know what the content is for.");
  const d = db();
  if (!d.checks.some((c) => c.revisionId === rev.revisionId)) throw new RuleError("Run a check on the current version first.");
  if (s.status === "changes_requested") {
    const last = d.decisions.filter((x) => x.submissionId === id).sort((x, y) => y.decidedAt.localeCompare(x.decidedAt))[0];
    if (last && rev.createdAt <= last.decidedAt) throw new RuleError("Upload a new version that addresses the requested changes before resubmitting.");
  }
  s.status = "in_review";
  s.updatedAt = nowIso();
  const assigned = autoAssign(s, "Sent for review.");
  if (hasActiveEmbargo(id)) for (const m of staff(a.orgId, ["manager"])) notify(m.userId, "A submission is on embargo hold.", id);
  return `Sent for review.${assigned}`;
}

export function assignReviewer(a: Actor, id: string, reviewerUserId: string): string {
  if (a.role !== "manager") throw new RuleError("Only managers assign reviewers.");
  const s = db().submissions.find((x) => x.submissionId === id && x.organizationId === a.orgId);
  if (!s) throw new RuleError("That submission was not found.");
  if (s.status !== "in_review") throw new RuleError("Only submissions in review can be assigned.");
  // check_assignment: an active reviewer of this company, never the creator.
  if (!eligibleReviewers(s).some((m) => m.userId === reviewerUserId)) throw new RuleError("Choose an active reviewer who did not create this content.");
  const open = openAssignments(id);
  if (open.some((x) => x.reviewerUserId === reviewerUserId)) return "Already assigned to that reviewer.";
  for (const x of open) {
    x.status = "done";
    x.updatedAt = nowIso();
    notify(x.reviewerUserId, "A review was reassigned to someone else.", id);
  }
  createAssignment(s, reviewerUserId, agentSettings(a.orgId)?.reviewDeadlineHours ?? 24);
  return open.length ? "Reassigned." : "Reviewer assigned.";
}

const DECISION_NOTE: Record<DecisionKind, string> = {
  approved: "Your submission was approved.",
  rejected: "Your submission was rejected.",
  changes_requested: "Changes requested on your submission.",
};

/** before_decision_insert + after_decision_insert. */
export function decide(a: Actor, id: string, decision: string, comments: string): string {
  if (a.role !== "reviewer") throw new RuleError("Only reviewers decide.");
  if (decision !== "approved" && decision !== "rejected" && decision !== "changes_requested") throw new RuleError("Choose a decision.");
  const d = db();
  const s = d.submissions.find((x) => x.submissionId === id && x.organizationId === a.orgId);
  if (!s) throw new RuleError("That submission was not found.");
  if (s.status !== "in_review") throw new RuleError("Only submissions in review can be decided.");
  if (s.createdByUserId === a.userId) throw new RuleError("You cannot decide on your own work.");
  const assignment = openAssignments(id).find((x) => x.reviewerUserId === a.userId);
  if (!assignment) throw new RuleError("This submission is not assigned to you.");
  const note = comments.trim();
  if (decision !== "approved" && !note) throw new RuleError("Say why, so the creator knows what to change.");
  if (note.length > 2000) throw new RuleError("Comments must be 2000 characters or fewer.");
  if (decision === "approved" && hasActiveEmbargo(id)) throw new RuleError("This cites an active embargo. It cannot be approved until the embargo lifts.");
  const rev = latestRevision(id)!;
  const now = nowIso();
  d.decisions.push({ decisionId: newId(), submissionId: id, revisionId: rev.revisionId, reviewerUserId: a.userId, decision, comments: note || null, decidedAt: now });
  s.status = decision;
  s.updatedAt = now;
  assignment.status = "done";
  assignment.updatedAt = now;
  notify(s.createdByUserId, DECISION_NOTE[decision], id);
  if (decision === "approved") for (const m of staff(a.orgId, ["manager"])) notify(m.userId, "Approved content is ready to be released.", id);
  return decision === "approved" ? `Approved version ${rev.version}.` : decision === "rejected" ? "Rejected. The creator has been told why." : "Changes requested. The creator has been notified.";
}
