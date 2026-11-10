import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBadge, Tag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/field";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { listCampaigns, orgSettings, reviewQueue } from "@/lib/data/queries";
import { CHANNEL_LABEL, CHANNELS, RISK_LABEL, RISKS, type Channel, type Risk } from "@/lib/domain";
import { formatDateTime, relative, requestTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Reviews" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Review queue (designPRD 3, 4.8): risk, campaign, channel and overdue filters; soonest due first. */
export default async function ReviewsPage({ params, searchParams }: PageProps<"/org/[orgId]/reviews">) {
  const { orgId } = await params;
  const { membership, actor } = await requireOrg(orgId, PAGE_ROLES.reviews);
  const sp = await searchParams;
  const risk = RISKS.includes(one(sp.risk) as Risk) ? (one(sp.risk) as Risk) : undefined;
  const channel = CHANNELS.includes(one(sp.channel) as Channel) ? (one(sp.channel) as Channel) : undefined;
  const campaigns = listCampaigns(actor);
  const campaignId = campaigns.some((c) => c.campaignId === one(sp.campaign)) ? one(sp.campaign) : undefined;
  const overdue = one(sp.overdue) === "1";
  const rows = reviewQueue(actor, { risk, channel, campaignId, overdue });
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const now = requestTime();
  const filtered = Boolean(risk || channel || campaignId || overdue);
  const isManager = membership.role === "manager";

  return (
    <>
      <PageHeader
        title="Reviews"
        description={isManager ? "Everything waiting for a reviewer. Assign or reassign from each review." : "Submissions assigned to you, soonest due first."}
      />
      <div className="mb-6">
        <DemoNotice />
      </div>

      <form method="get" aria-label="Filter reviews" className="glass mb-6 grid gap-4 rounded-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] lg:items-end">
        <SelectField label="Risk" name="risk" defaultValue={risk ?? ""}>
          <option value="">Any risk</option>
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {RISK_LABEL[r]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Channel" name="channel" defaultValue={channel ?? ""}>
          <option value="">Any channel</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Campaign" name="campaign" defaultValue={campaignId ?? ""}>
          <option value="">Any campaign</option>
          {campaigns.map((c) => (
            <option key={c.campaignId} value={c.campaignId}>
              {c.campaignName}
            </option>
          ))}
        </SelectField>
        <label className="flex min-h-11 items-center gap-2 text-[14px] font-medium">
          <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-5 accent-[var(--color-accent)]" />
          Overdue only
        </label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? (
            <ButtonLink href={orgPath(orgId, "reviews")} variant="ghost">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>

      <p role="status" className="mb-3 text-[14px] text-text-muted">
        {rows.length} waiting{filtered ? " (filtered)" : ""}
      </p>

      {rows.length ? (
        <Table caption="Review queue">
          <thead>
            <tr>
              <Th>Submission</Th>
              <Th>Risk</Th>
              <Th>Due</Th>
              <Th className="hidden md:table-cell">{isManager ? "Reviewer" : "Channel"}</Th>
              <Th className="hidden lg:table-cell">Creator</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const late = s.dueAt !== null && Date.parse(s.dueAt) < now;
              return (
                <Tr key={s.submissionId}>
                  <Td className="min-w-48">
                    <Link href={orgPath(orgId, `reviews/${s.submissionId}`)} className="font-semibold text-text underline-offset-2 hover:underline">
                      {s.intentSummary ?? "Untitled submission"}
                    </Link>
                    <p className="text-[12px] text-text-muted">
                      {s.campaignName ?? "No campaign"} · v{s.version}
                    </p>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      {s.risk ? <RiskBadge risk={s.risk} /> : <span className="text-[13px] text-text-muted">Not checked</span>}
                      {s.embargoHold ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger-ink">
                          <Lock aria-hidden className="size-3.5" />
                          Embargo hold
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {s.dueAt ? (
                      <>
                        {late ? <Tag className="mb-1">Overdue</Tag> : null}
                        <p className="text-[14px]">{formatDateTime(s.dueAt, tz)}</p>
                        <p className="text-[12px] text-text-muted">{relative(s.dueAt, now)}</p>
                      </>
                    ) : (
                      <span className="text-[13px] text-text-muted">No reviewer</span>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    {isManager ? (s.reviewers.length ? s.reviewers.map((r) => r.name).join(", ") : <Tag>Unassigned</Tag>) : CHANNEL_LABEL[s.channel]}
                  </Td>
                  <Td className="hidden lg:table-cell">{s.creatorName}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={filtered ? "No matches" : "Nothing waiting"} description={filtered ? "Try fewer filters." : "Submissions appear here when they are sent for review."} />
      )}
    </>
  );
}
