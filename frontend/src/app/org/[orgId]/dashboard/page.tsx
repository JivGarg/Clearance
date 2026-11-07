import { CircleCheckBig, Clock, FileText, ShieldAlert, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList, ChartCard } from "@/components/charts/charts";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionsTable } from "@/components/submissions/submissions-table";
import { RiskBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, GradientHeroCard, MetricCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isActiveEmbargo, isCurrentFact, isStaff, listEmbargoes, listFacts, listMembers, listSubmissions, metrics, orgRow, orgSettings } from "@/lib/data/queries";
import { ROLE_LABEL, STATUS_LABEL, STATUSES, type Risk } from "@/lib/domain";
import { relative, requestTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

const RISK_BAR: Record<Risk, string> = { low: "bg-success-ink", medium: "bg-warning-ink", high: "bg-danger-ink" };

/** Overview (designPRD 2.4 frame 1). Every number is derived from rows this person may see. */
export default async function DashboardPage({ params }: PageProps<"/org/[orgId]/dashboard">) {
  const { orgId } = await params;
  const { user, membership, actor } = await requireOrg(orgId, PAGE_ROLES.dashboard);
  const company = orgRow(orgId)?.companyName ?? "Your company";
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const canSubmit = PAGE_ROLES["submissions/new"].includes(membership.role);
  const m = metrics(actor);
  const recent = listSubmissions(actor).slice(0, 5);
  const scope = isStaff(actor) ? "across the company" : membership.role === "creator" ? "of your own" : "assigned to you";

  // Admin attention list: things that need someone to act.
  const attention: { label: string; href: string; when?: string }[] = [];
  if (isStaff(actor)) {
    const now = requestTime();
    for (const e of listEmbargoes(actor).filter((x) => isActiveEmbargo(x, now)))
      attention.push({ label: `Embargo lifts: ${e.restrictedItem}`, href: orgPath(orgId, "embargoes"), when: relative(e.releaseAt, now) });
    for (const f of listFacts(actor).filter((x) => x.validUntil && isCurrentFact(x, now) && Date.parse(x.validUntil) - now < 30 * 86_400_000))
      attention.push({ label: `Fact expires: ${f.fact}`, href: orgPath(orgId, `knowledge/${f.factId}`), when: relative(f.validUntil!, now) });
    if (actor.role === "admin") {
      const invited = listMembers(actor).filter((x) => x.status === "invited").length;
      if (invited) attention.push({ label: `${invited} invitation(s) not accepted yet`, href: orgPath(orgId, "users") });
    }
    if (m.byStatus.approved) attention.push({ label: `${m.byStatus.approved} approved, waiting to be released`, href: orgPath(orgId, "submissions?status=approved") });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader
          title={`Welcome, ${user.name.split(" ")[0]}`}
          description={`${ROLE_LABEL[membership.role]} at ${company}`}
          actions={canSubmit ? <ButtonLink href={orgPath(orgId, "submissions/new")}>Submit content</ButtonLink> : undefined}
        />
        <DemoNotice />
      </div>

      <GradientHeroCard eyebrow={company} title="Nothing goes live without clearance.">
        Every draft is checked against your approved guidelines, facts and embargoes. Routine fixes
        are suggested automatically; anything risky waits for an authorised reviewer.
      </GradientHeroCard>

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="mb-3 font-serif text-2xl">
          At a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Submissions" value={m.total} hint={`All submissions ${scope}`} icon={<FileText className="size-4" />} />
          <MetricCard label="Cleared" value={m.cleared} hint="Approved or released" icon={<CircleCheckBig className="size-4" />} />
          <MetricCard label="In review" value={m.inReview} hint="Waiting for a reviewer" icon={<Clock className="size-4" />} />
          <MetricCard label="High-risk holds" value={m.highRiskHolds} hint="In review with a high-risk check" icon={<ShieldAlert className="size-4" />} />
          <MetricCard label="Auto-fixes" value={m.autoFixes} hint="Low-risk fixes applied by the agent" icon={<Sparkles className="size-4" />} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="recent" className="font-serif text-2xl">
              Recent submissions
            </h2>
            {recent.length ? (
              <Link href={orgPath(orgId, "submissions")} className="text-[14px] font-medium text-accent">
                View all
              </Link>
            ) : null}
          </div>
          {recent.length ? (
            <SubmissionsTable orgId={orgId} rows={recent} timeZone={tz} caption="Five most recent submissions" />
          ) : (
            <EmptyState
              title="No submissions yet"
              description="Submitted drafts appear here with their status and risk."
              action={
                canSubmit ? (
                  <ButtonLink href={orgPath(orgId, "submissions/new")} variant="secondary">
                    Submit your first draft
                  </ButtonLink>
                ) : undefined
              }
            />
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <ChartCard title="Risk mix" description="Findings on the current version of each submission">
            <BarList
              emptyText="No findings yet."
              data={(["high", "medium", "low"] as Risk[]).map((r) => ({
                label: `${r} risk`,
                value: m.findingsByRisk[r],
                labelNode: <RiskBadge risk={r} />,
                barClass: RISK_BAR[r],
              }))}
            />
          </ChartCard>
          <ChartCard title="Content flow" description="Submissions by status">
            <BarList
              emptyText="No submissions yet."
              data={STATUSES.map((s) => ({
                label: STATUS_LABEL[s],
                value: m.byStatus[s],
                href: orgPath(orgId, `submissions?status=${s}`),
              }))}
            />
          </ChartCard>
        </div>
      </div>

      {isStaff(actor) ? (
        <Card>
          <h2 className="font-serif text-2xl">Needs attention</h2>
          {attention.length ? (
            <ul className="mt-3 divide-y divide-border/70">
              {attention.map((x) => (
                <li key={x.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={x.href} className="min-w-0 text-[15px] text-text underline-offset-2 hover:underline">
                    {x.label}
                  </Link>
                  {x.when ? <span className="text-[13px] text-text-muted">{x.when}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-text-muted">Nothing waiting on you.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
