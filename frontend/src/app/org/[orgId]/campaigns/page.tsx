import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FormDialog } from "@/components/forms/form-dialog";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/field";
import { saveCampaignAction } from "@/lib/actions/admin";
import { listCampaigns, type CampaignView } from "@/lib/data/queries";
import { CHANNEL_LABEL, type Channel } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Campaigns" };

function CampaignFields({ c }: { c?: CampaignView }) {
  return (
    <>
      <TextField label="Campaign name" name="name" defaultValue={c?.campaignName} required maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Start date" name="startDate" type="date" defaultValue={c?.startDate ?? ""} />
        <TextField label="End date" name="endDate" type="date" defaultValue={c?.endDate ?? ""} hint="On or after the start." />
      </div>
    </>
  );
}

function phase(c: CampaignView, today: string): string {
  if (c.startDate && today < c.startDate) return "Upcoming";
  if (c.endDate && today > c.endDate) return "Ended";
  return "Running";
}

/** Campaigns and their channel mix (designPRD 3). Admins and managers edit. */
export default async function CampaignsPage({ params }: PageProps<"/org/[orgId]/campaigns">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.campaigns);
  const campaigns = listCampaigns(actor);
  const today = new Date().toISOString().slice(0, 10);
  const hidden = { orgId };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Group submissions by campaign to compare channels and spot conflicting claims."
        actions={
          <FormDialog triggerLabel="Add campaign" triggerIcon={<Plus aria-hidden className="size-4" />} title="Add campaign" action={saveCampaignAction} hidden={hidden} submitLabel="Add campaign">
            <CampaignFields />
          </FormDialog>
        }
      />
      <div className="mb-6">
        <DemoNotice extra="Cross-channel contradiction checks (designPRD 4.10) are not built yet." />
      </div>
      {campaigns.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const channels = Object.entries(c.byChannel) as [Channel, number][];
            return (
              <Card key={c.campaignId} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-serif text-2xl break-words">{c.campaignName}</h2>
                    <p className="text-[13px] text-text-muted">
                      {formatDate(c.startDate)} to {formatDate(c.endDate)}
                    </p>
                  </div>
                  <Tag>{phase(c, today)}</Tag>
                </div>
                <p className="text-[15px]">
                  <Link href={orgPath(orgId, `submissions?campaign=${c.campaignId}`)} className="font-semibold">
                    {c.submissionCount} {c.submissionCount === 1 ? "submission" : "submissions"}
                  </Link>
                  , {c.clearedCount} cleared
                </p>
                {channels.length ? (
                  <ul className="flex flex-wrap gap-2 text-[13px]" aria-label="Submissions by channel">
                    {channels.map(([ch, n]) => (
                      <li key={ch} className="rounded-full border border-border bg-surface px-2.5 py-0.5">
                        {CHANNEL_LABEL[ch]}: {n}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-text-muted">No submissions yet.</p>
                )}
                <div className="mt-auto pt-1">
                  <FormDialog triggerLabel="Edit" triggerIcon={<Pencil aria-hidden className="size-3.5" />} triggerVariant="secondary" triggerSize="sm" triggerAriaLabel={`Edit campaign ${c.campaignName}`} title="Edit campaign" action={saveCampaignAction} hidden={{ ...hidden, id: c.campaignId }}>
                    <CampaignFields c={c} />
                  </FormDialog>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No campaigns yet" description="Create a campaign so creators can file submissions under it." />
      )}
    </>
  );
}
