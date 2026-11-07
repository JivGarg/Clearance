import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InlineForm } from "@/components/forms/inline-form";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBadge, Tag } from "@/components/ui/badge";
import { AutonomyControl } from "@/components/ui/autonomy-control";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { saveAgentSettingsAction } from "@/lib/actions/admin";
import { AGENT_ACTION_LABEL, agentSettings, auditTimeline, orgSettings } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "AI Agent Settings" };

/** Agent actions, risk rules and limits (designPRD 3, 4.6). Admin only. */
export default async function AgentPage({ params }: PageProps<"/org/[orgId]/agent">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.agent);
  const s = agentSettings(orgId) ?? { lowRisk: "auto_fix", mediumRisk: "ask_first", maxCheckAttempts: 3, reviewDeadlineHours: 24, updatedAt: null };
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const actions = auditTimeline(actor, "agent").slice(0, 10);

  return (
    <>
      <PageHeader title="AI Agent Settings" description="What the agent may do on its own at each risk level. Risk is set by policy rules; the agent can never lower it or approve content." />
      <div className="mb-6">
        <DemoNotice extra="These settings have no database table yet, and the mock checker does not read them yet." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <InlineForm action={saveAgentSettingsAction} hidden={{ orgId }} ariaLabel="Agent settings">
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge risk="low" />
                <h2 className="font-semibold">Low-risk findings</h2>
              </div>
              <p className="text-[14px] text-text-muted">Deterministic fixes like product spelling. Every change is logged and can be undone.</p>
              <AutonomyControl legend="Low-risk findings" name="lowRisk" defaultValue={s.lowRisk} />
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge risk="medium" />
                <h2 className="font-semibold">Medium-risk findings</h2>
              </div>
              <p className="text-[14px] text-text-muted">The agent prepares a fix; a permitted person must approve it. Auto-fix is not available here.</p>
              <AutonomyControl legend="Medium-risk findings" name="mediumRisk" defaultValue={s.mediumRisk} levels={["ask_first", "recommend_only"]} />
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge risk="high" />
                <h2 className="font-semibold">High-risk findings</h2>
                <Tag>
                  <Lock aria-hidden className="size-3.5" />
                  Fixed by policy
                </Tag>
              </div>
              <p className="text-[14px]">Always a publishing hold, routed to an authorised reviewer. Never auto-cleared. This cannot be changed.</p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Check attempts per submission"
                name="maxCheckAttempts"
                type="number"
                min={1}
                max={10}
                step={1}
                defaultValue={String(s.maxCheckAttempts)}
                hint="Stops endless fix-and-recheck loops. 1 to 10."
              />
              <TextField
                label="Review deadline (hours)"
                name="reviewDeadlineHours"
                type="number"
                min={1}
                max={336}
                step={1}
                defaultValue={String(s.reviewDeadlineHours)}
                hint="Reviews past this are marked overdue and escalated."
              />
            </div>
            {s.updatedAt ? <p className="text-[13px] text-text-muted">Last changed {formatDateTime(s.updatedAt, tz)}</p> : null}
          </InlineForm>
        </Card>

        <Card>
          <h2 className="font-serif text-2xl">Recent agent actions</h2>
          {actions.length ? (
            <ul className="mt-3 flex flex-col gap-3 text-[14px]">
              {actions.map((x) => (
                <li key={x.id}>
                  <p>{x.summary}</p>
                  <p className="text-[13px] text-text-muted">
                    {formatDateTime(x.at, tz)}
                    {x.submissionId ? (
                      <>
                        {" · "}
                        <Link href={orgPath(orgId, `submissions/${x.submissionId}`)}>View submission</Link>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-text-muted">The agent has not acted yet.</p>
          )}
          <p className="mt-4 text-[13px] text-text-muted">
            Action types: {Object.values(AGENT_ACTION_LABEL).join(", ")}. <Link href={orgPath(orgId, "audit?kind=agent")}>Full history</Link>
          </p>
        </Card>
      </div>
    </>
  );
}
