import type { Metadata } from "next";
import Link from "next/link";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionsTable } from "@/components/submissions/submissions-table";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/field";
import { listCampaigns, listSubmissions, orgSettings } from "@/lib/data/queries";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, STATUSES, type Channel, type SubmissionStatus } from "@/lib/domain";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Submissions" };

const PAGE_SIZE = 10;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Searchable submission list (designPRD 3). The filter bar is a GET form: works without JS, shareable URLs. */
export default async function SubmissionsPage({ params, searchParams }: PageProps<"/org/[orgId]/submissions">) {
  const { orgId } = await params;
  const { membership, actor } = await requireOrg(orgId, PAGE_ROLES.submissions);
  const sp = await searchParams;
  const q = one(sp.q);
  const status = STATUSES.includes(one(sp.status) as SubmissionStatus) ? (one(sp.status) as SubmissionStatus) : undefined;
  const channel = CHANNELS.includes(one(sp.channel) as Channel) ? (one(sp.channel) as Channel) : undefined;
  const campaigns = listCampaigns(actor);
  const campaignId = campaigns.some((c) => c.campaignId === one(sp.campaign)) ? one(sp.campaign) : undefined;
  const sort = one(sp.sort) === "oldest" ? "oldest" : "newest";

  const rows = listSubmissions(actor, { q, status, channel, campaignId, sort });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = Boolean(q || status || channel || campaignId);
  const tz = orgSettings(orgId)?.timezone ?? "UTC";

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (channel) next.set("channel", channel);
    if (campaignId) next.set("campaign", campaignId);
    if (sort !== "newest") next.set("sort", sort);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return orgPath(orgId, `submissions${qs ? `?${qs}` : ""}`);
  };

  const description =
    membership.role === "creator"
      ? "Your drafts and their review status."
      : membership.role === "reviewer"
        ? "Submissions assigned to you."
        : "Every submission in the company. Admins can view and release; only reviewers decide.";

  return (
    <>
      <PageHeader
        title="Submissions"
        description={description}
        actions={PAGE_ROLES["submissions/new"].includes(membership.role) ? <ButtonLink href={orgPath(orgId, "submissions/new")}>New submission</ButtonLink> : undefined}
      />
      <div className="mb-6">
        <DemoNotice />
      </div>

      <form method="get" role="search" aria-label="Filter submissions" className="glass mb-6 grid gap-4 rounded-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <TextField label="Search" name="q" type="search" defaultValue={q} placeholder="Intent, creator, campaign" />
        <SelectField label="Status" name="status" defaultValue={status ?? ""}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
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
        <SelectField label="Sort" name="sort" defaultValue={sort}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </SelectField>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? (
            <ButtonLink href={orgPath(orgId, "submissions")} variant="ghost">
              Clear
            </ButtonLink>
          ) : null}
        </div>
      </form>

      <p role="status" className="mb-3 text-[14px] text-text-muted">
        {rows.length} {rows.length === 1 ? "submission" : "submissions"}
        {filtered ? " match these filters" : ""}
      </p>

      {shown.length ? (
        <SubmissionsTable orgId={orgId} rows={shown} timeZone={tz} caption="Submissions" />
      ) : (
        <EmptyState
          title={filtered ? "No matches" : "No submissions yet"}
          description={filtered ? "Try fewer filters or a different search." : "Submitted drafts will appear here."}
        />
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-[14px]">
          {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span />}
          <span className="text-text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={pageHref(page + 1)}>Next</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}
