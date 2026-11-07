import { CircleCheckBig, Clock, FileText, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, GradientHeroCard, MetricCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { orgName } from "@/lib/demo-users";
import { ROLE_LABEL } from "@/lib/domain";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Overview (designPRD 2.4 frame 1). The database is not connected yet, so every number is shown
 * as unavailable rather than invented (designPRD 4.11, A14).
 */
export default async function DashboardPage({ params }: PageProps<"/org/[orgId]/dashboard">) {
  const { orgId } = await params;
  const { user, membership } = await requireOrg(orgId, PAGE_ROLES.dashboard);
  const canSubmit = PAGE_ROLES["submissions/new"].includes(membership.role);
  const noData = "Not connected to the database yet";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={`${ROLE_LABEL[membership.role]} at ${orgName(orgId)}`}
        actions={canSubmit ? <ButtonLink href={orgPath(orgId, "submissions/new")}>Submit content</ButtonLink> : undefined}
      />

      <GradientHeroCard eyebrow={orgName(orgId)} title="Nothing goes live without clearance.">
        Every draft is checked against your approved guidelines, facts and embargoes. Routine fixes
        are suggested automatically; anything risky waits for an authorised reviewer.
      </GradientHeroCard>

      <section aria-labelledby="kpis">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="kpis" className="font-serif text-2xl">
            At a glance
          </h2>
          <Tag>No live data yet</Tag>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Submissions" value={null} hint={noData} icon={<FileText className="size-4" />} />
          <MetricCard label="Cleared" value={null} hint={noData} icon={<CircleCheckBig className="size-4" />} />
          <MetricCard label="In review" value={null} hint={noData} icon={<Clock className="size-4" />} />
          <MetricCard label="High-risk holds" value={null} hint={noData} icon={<ShieldAlert className="size-4" />} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-3 font-serif text-2xl">
            Recent submissions
          </h2>
          <EmptyState
            title="No submissions to show"
            description="Recent work appears here once the app reads from Supabase."
            action={
              canSubmit ? (
                <ButtonLink href={orgPath(orgId, "submissions/new")} variant="secondary">
                  Submit your first draft
                </ButtonLink>
              ) : undefined
            }
          />
        </section>
        <Card>
          <h2 className="font-serif text-2xl">Risk mix</h2>
          <p className="mt-2 text-[14px] text-text-muted">
            The low, medium and high split of open findings will be charted here from real data.
          </p>
        </Card>
      </div>
    </div>
  );
}
