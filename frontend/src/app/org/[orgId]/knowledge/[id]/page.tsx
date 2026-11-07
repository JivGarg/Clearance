import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBadge, StatusBadge, Tag, VisibilityBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { capitalise, citationsOf, findSource, isCurrentFact, orgSettings } from "@/lib/data/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Source" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-[13px] font-semibold text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[15px]">{children}</dd>
    </div>
  );
}

/** Source details (designPRD 3, 4.2): what it says, its version and visibility, and what cites it. */
export default async function SourcePage({ params }: PageProps<"/org/[orgId]/knowledge/[id]">) {
  const { orgId, id } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.knowledge);
  const source = findSource(actor, id);
  if (!source) notFound(); // missing, other company, or not allowed: same answer
  if (source.type === "embargo") redirect(orgPath(orgId, "embargoes"));
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const cites = citationsOf(actor, id);

  let body: React.ReactNode;
  if (source.type === "guideline") {
    const g = source.row;
    body = (
      <>
        <Row label="Rule">{g.rule}</Row>
        <Row label="Category">{capitalise(g.category)}</Row>
        <Row label="Version">v{g.version}</Row>
        <Row label="Visibility">Every member of the company</Row>
        <Row label="Last changed">{formatDateTime(g.updatedAt, tz)}</Row>
      </>
    );
  } else if (source.type === "fact") {
    const f = source.row;
    body = (
      <>
        <Row label="Fact">{f.fact}</Row>
        <Row label="Source">{f.source}</Row>
        <Row label="Valid until">
          {f.validUntil ? formatDate(f.validUntil, tz) : "No expiry"} {!isCurrentFact(f) ? <Tag className="ml-1">Expired: not used by checks</Tag> : null}
        </Row>
        <Row label="Visibility">
          <VisibilityBadge value={f.confidentialityLevel} />
        </Row>
        <Row label="Last changed">{formatDateTime(f.updatedAt, tz)}</Row>
      </>
    );
  } else {
    const x = source.row;
    body = (
      <>
        <Row label="File">{x.storagePath}</Row>
        <Row label="Type">{capitalise(x.assetType)}</Row>
        <Row label="Visibility">
          <VisibilityBadge value={x.visibility} />
        </Row>
        <Row label="Last changed">{formatDateTime(x.updatedAt, tz)}</Row>
        <Row label="Preview">Not available yet: files arrive with Supabase Storage (private, signed links).</Row>
      </>
    );
  }

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href={orgPath(orgId, `knowledge?tab=${source.type === "guideline" ? "guidelines" : source.type === "fact" ? "facts" : "assets"}`)}>Back to Knowledge Base</Link>
      </p>
      <PageHeader title={source.title} />
      <div className="mb-6">
        <DemoNotice />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <dl className="flex flex-col gap-4">{body}</dl>
        </Card>
        <Card>
          <h2 className="font-serif text-2xl">Cited by</h2>
          <p className="mt-1 text-[13px] text-text-muted">Findings that point to this source, on submissions you can see.</p>
          {cites.length ? (
            <ul className="mt-3 flex flex-col gap-3">
              {cites.map(({ issue, submission }) => (
                <li key={issue.issueId} className="text-[14px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge risk={issue.riskLevel} />
                    <StatusBadge status={submission.status} />
                  </div>
                  <Link href={orgPath(orgId, `submissions/${submission.submissionId}`)} className="mt-1 block font-medium">
                    {submission.intentSummary ?? "Submission"}
                  </Link>
                  <p className="text-text-muted">{issue.explanation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-text-muted">No findings cite this source yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
