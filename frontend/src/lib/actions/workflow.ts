"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions/types";
import { CheckServiceError } from "@/lib/check-service";
import { RuleError } from "@/lib/data/mutations";
import type { Actor } from "@/lib/data/queries";
import * as w from "@/lib/data/workflow";
import type { Role } from "@/lib/domain";
import { orgPath } from "@/lib/roles";
import { actorFor } from "@/lib/session";

/**
 * Server actions for the creator, reviewer and manager flows. Each re-checks session and role on
 * the server, then calls a rule-enforcing workflow step. See actions/admin.ts for the pattern.
 */

async function run(fd: FormData, roles: readonly Role[], fn: (a: Actor, get: (k: string) => string) => Promise<ActionState> | ActionState): Promise<ActionState> {
  const at = Date.now();
  const actor = await actorFor(String(fd.get("orgId") ?? ""), roles);
  if (!actor) return { ok: false, error: "You don't have permission to do this.", at };
  try {
    const result = await fn(actor, (k) => String(fd.get(k) ?? ""));
    revalidatePath("/org/[orgId]", "layout"); // see CONTEXT.md gotchas: not refresh()
    return { ok: true, ...result, at };
  } catch (e) {
    if (e instanceof RuleError || e instanceof CheckServiceError) {
      revalidatePath("/org/[orgId]", "layout");
      return { ok: false, error: e.message, at };
    }
    throw e;
  }
}

const CREATOR: readonly Role[] = ["creator"];

export async function createSubmissionAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, async (a, g) => {
    const { id, message } = await w.createSubmission(a, { content: g("content"), channel: g("channel"), campaignId: g("campaignId") });
    return { message, redirectTo: orgPath(a.orgId, `submissions/${id}`) };
  });
}
export async function runCheckAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, async (a, g) => ({ message: (await w.runCheck(a, g("id"))).message }));
}
export async function confirmIntentAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, (a, g) => ({
    message: w.confirmIntent(a, g("id"), { goal: g("goal"), audience: g("audience"), keyMessage: g("keyMessage"), callToAction: g("callToAction") }),
  }));
}
export async function reviseAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, async (a, g) => ({ message: await w.reviseContent(a, g("id"), g("content"), g("summary")) }));
}
export async function applyFixesAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, async (a, g) => ({ message: await w.applySelectedFixes(a, g("id"), fd.getAll("fix").map(String)) }));
}
export async function sendForReviewAction(_p: ActionState, fd: FormData) {
  return run(fd, CREATOR, (a, g) => ({ message: w.sendForReview(a, g("id")) }));
}
export async function assignReviewerAction(_p: ActionState, fd: FormData) {
  return run(fd, ["manager"], (a, g) => ({ message: w.assignReviewer(a, g("id"), g("reviewerUserId")) }));
}
export async function decideAction(_p: ActionState, fd: FormData) {
  return run(fd, ["reviewer"], (a, g) => ({ message: w.decide(a, g("id"), g("decision"), g("comments")) }));
}
