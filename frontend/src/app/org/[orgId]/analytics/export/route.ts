import { listSubmissions } from "@/lib/data/queries";
import { CHANNELS, type Channel } from "@/lib/domain";
import { PAGE_ROLES } from "@/lib/roles";
import { actorFor } from "@/lib/session";

/** CSV export "where authorised" (designPRD 4.11): admins and managers, own company only. */
export async function GET(request: Request, { params }: RouteContext<"/org/[orgId]/analytics/export">) {
  const { orgId } = await params;
  const actor = await actorFor(orgId, PAGE_ROLES.analytics);
  if (!actor) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const ch = url.searchParams.get("channel");
  const channel = CHANNELS.includes(ch as Channel) ? (ch as Channel) : undefined;
  const campaignId = url.searchParams.get("campaign") ?? undefined;
  const rows = listSubmissions(actor, { channel, campaignId, sort: "oldest" });

  // Quote every cell; neutralise spreadsheet formulas (cells starting with = + - @).
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["submission_id", "created_at", "status", "risk", "findings", "channel", "type", "campaign", "creator", "version", "embargo_hold", "intent"];
  const lines = rows.map((r) =>
    [r.submissionId, r.createdAt, r.status, r.risk, r.findingCount, r.channel, r.type, r.campaignName, r.creatorName, r.version, r.embargoHold ? "yes" : "no", r.intentSummary]
      .map(cell)
      .join(","),
  );
  const body = [header.join(","), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clearance-submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
