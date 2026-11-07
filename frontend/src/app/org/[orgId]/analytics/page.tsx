import { Download } from "lucide-react";
import type { Metadata } from "next";
import { BarList, ChartCard, GroupedColumns } from "@/components/charts/charts";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, MetricCard } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { listCampaigns, metrics } from "@/lib/data/queries";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, STATUSES, type Channel, type Risk } from "@/lib/domain";
import { hours, percent } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Analytics" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const RISK_BAR: Record<Risk, string> = { low: "bg-success-ink", medium: "bg-warning-ink", high: "bg-danger-ink" };

/** Insights (designPRD 2.4 frame 4, 4.11). Every figure is computed from stored rows; zero denominators show N/A. */
export default async function AnalyticsPage({ params, searchParams }: PageProps<"/org/[orgId]/analytics">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.analytics);
  const sp = await searchParams;
  const channel = CHANNELS.includes(one(sp.channel) as Channel) ? (one(sp.channel) as Channel) : undefined;
  const campaigns = listCampaigns(actor);
  const campaignId = campaigns.some((c) => c.campaignId === one(sp.campaign)) ? one(sp.campaign) : undefined;
  const m = metrics(actor, { channel, campaignId });
  const qs = new URLSearchParams({ ...(channel ? { channel } : {}), ...(campaignId ? { campaign: campaignId } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How content moves through clearance, and where it gets stuck."
        actions={
          <ButtonLink href={orgPath(orgId, `analytics/export${qs ? `?${qs}` : ""}`)} variant="secondary" prefetch={false}>
            <Download aria-hidden className="size-4" />
            Export CSV
          </ButtonLink>
        }
      />
      <div className="mb-6">
        <DemoNotice extra="With this few records, trends are illustrative only." />
      </div>

      <form method="get" aria-label="Filter analytics" className="glass mb-6 grid gap-4 rounded-card p-4 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto] sm:items-end">
        <SelectField label="Channel" name="channel" defaultValue={channel ?? ""}>
          <option value="">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Campaign" name="campaign" defaultValue={campaignId ?? ""}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.campaignId} value={c.campaignId}>
              {c.campaignName}
            </option>
          ))}
        </SelectField>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {qs ? (
            <ButtonLink href={orgPath(orgId, "analytics")} variant="ghost">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="kpi" className="mb-6">
        <h2 id="kpi" className="sr-only">
          Key figures
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Submissions" value={m.total} hint="Matching the filters" />
          <MetricCard label="Clearance rate" value={percent(m.clearanceRate)} hint="Cleared ÷ submissions with a decision" />
          <MetricCard label="Average review time" value={hours(m.avgReviewHours)} hint="Assignment to decision" />
          <MetricCard label="High-risk holds" value={m.highRiskHolds} hint={`${m.autoFixes} low-risk auto-fix(es) applied`} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Submitted vs cleared" description="Per week: submissions created, and approvals decided" className="xl:col-span-2">
          <GroupedColumns
            caption="Submitted and cleared per week"
            series={[
              { name: "Submitted", barClass: "bg-accent", swatchClass: "bg-accent" },
              { name: "Cleared", barClass: "bg-chart-gold", swatchClass: "bg-chart-gold" },
            ]}
            points={m.weekly.map((w) => ({ label: w.label, values: [w.submitted, w.cleared] }))}
          />
        </ChartCard>
        <ChartCard title="Risk distribution" description="Findings on the current version of each submission">
          <BarList
            emptyText="No findings."
            data={(["high", "medium", "low"] as Risk[]).map((r) => ({ label: `${r} risk`, value: m.findingsByRisk[r], labelNode: <RiskBadge risk={r} />, barClass: RISK_BAR[r] }))}
          />
        </ChartCard>
        <ChartCard title="Top issue categories" description="Most common finding types">
          <BarList emptyText="No findings." data={m.topIssueTypes.map((t) => ({ label: t.label, value: t.count }))} />
        </ChartCard>
        <ChartCard title="Status breakdown" description="Where submissions are now">
          <BarList emptyText="No submissions." data={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: m.byStatus[s], href: orgPath(orgId, `submissions?status=${s}`) }))} />
        </ChartCard>
        <ChartCard title="Most-cited guidelines" description="Rules that content breaks most often: candidates for clearer guidance">
          <BarList emptyText="No guideline findings." data={m.topGuidelines.map((g) => ({ label: g.label, value: g.count, href: orgPath(orgId, `knowledge/${g.id}`) }))} />
        </ChartCard>
      </div>

      <Card className="mt-6">
        <h2 className="font-serif text-2xl">How these are calculated</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px]">
          <li>
            <span className="font-semibold">Cleared</span> = approved or released.
          </li>
          <li>
            <span className="font-semibold">Clearance rate</span> = cleared submissions ÷ submissions that received a reviewer decision. N/A when none have.
          </li>
          <li>
            <span className="font-semibold">Average review time</span> = time from a reviewer being assigned to their decision.
          </li>
          <li>
            <span className="font-semibold">High-risk holds</span> = in review, with a high-risk result on the current version.
          </li>
          <li>Findings count only the current version, and only findings you are allowed to see.</li>
        </ul>
      </Card>
    </>
  );
}
