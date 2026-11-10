import "server-only";
import type { Channel, Risk } from "@/lib/domain";

/**
 * Client for the backend check service (FastAPI `POST /api/checks/run`). Called only from the
 * server, so content never goes from the browser to a third party. Today the service is the
 * labelled rule-based mock (`mock-rules-v1`); a real pipeline keeps the same contract.
 * If the service is down we say so and let the person retry: never a fake result (designPRD A13).
 */

export class CheckServiceError extends Error {}

export interface ServiceIssue {
  id: string;
  risk: Risk;
  type: string;
  location: { kind: "text"; start: number; end: number } | null;
  finding: string;
  explanation: string;
  source: { kind: "guideline" | "fact" | "asset" | "embargo"; label: string; section?: string | null };
  suggested_fix: string | null;
  state: "open" | "applied" | "accepted" | "rejected" | "cleared";
  rule?: string | null;
}

export interface ServiceResult {
  intent: { goal: string; audience: string; key_message: string; call_to_action: string };
  issues: ServiceIssue[];
  agent_questions: string[];
  route: { target: string; hold: boolean; highest_risk: Risk | null; reason: string };
  mock: boolean;
  service_used: string;
}

export function checkServiceUrl(): string {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
}

export async function runCheckService(input: {
  submissionId: string;
  channel: Channel;
  content: string;
  autonomy: Record<Risk, "auto_fix" | "ask_first" | "recommend_only">;
}): Promise<ServiceResult> {
  let res: Response;
  try {
    res = await fetch(`${checkServiceUrl()}/api/checks/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: input.submissionId, channel: input.channel, content: input.content, autonomy: input.autonomy }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new CheckServiceError("The check service is not reachable right now. Your draft is saved; try the check again in a moment.");
  }
  if (!res.ok) throw new CheckServiceError(`The check service returned an error (${res.status}). Your draft is saved; try again.`);
  const body = (await res.json()) as Partial<ServiceResult>;
  if (!Array.isArray(body.issues) || !body.intent || !body.route || typeof body.service_used !== "string") {
    throw new CheckServiceError("The check service sent an unexpected response. Nothing was recorded; try again.");
  }
  return body as ServiceResult;
}
