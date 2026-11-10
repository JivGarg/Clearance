import type { Metadata } from "next";
import Link from "next/link";
import { InlineForm } from "@/components/forms/inline-form";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { createSubmissionAction } from "@/lib/actions/workflow";
import { listCampaigns } from "@/lib/data/queries";
import { CHANNEL_LABEL, CHANNELS } from "@/lib/domain";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "New submission" };

const STEPS = [
  ["Write or paste", "Your draft text, the channel and (optionally) the campaign."],
  ["Automatic check", "Checked against approved guidelines, facts and embargoes. Low-risk fixes may be applied for you."],
  ["Confirm intent", "Say what the content is for, so fixes keep your meaning."],
  ["Accept fixes", "Accept or skip each suggestion; accepted ones become a new version."],
  ["Send for review", "An authorised reviewer approves, rejects or asks for changes."],
];

const SAMPLE =
  "OMG you guys, the new SonicX 1 is the cheap way to get 60 hours of battery! It helps you fall asleep faster. Students get 25% off with our discount code STUDENT20. Sneak peek of Project Nova coming soon. #SonicSummer [image]";

/** New submission (designPRD 2.4 frame 2, 4.3). Creators only. Text in this build. */
export default async function NewSubmissionPage({ params }: PageProps<"/org/[orgId]/submissions/new">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES["submissions/new"]);
  const campaigns = listCampaigns(actor);

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href={orgPath(orgId, "submissions")}>Back to submissions</Link>
      </p>
      <PageHeader title="New submission" description="Check your draft before anyone else sees it. Nothing is published from here." />
      <div className="mb-6">
        <DemoNotice extra="Checks run on the labelled rule-based mock service, not an AI model." />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <InlineForm action={createSubmissionAction} hidden={{ orgId }} ariaLabel="New submission" submitLabel="Save draft and check">
            <TextAreaField label="Text" name="content" rows={8} required maxLength={5000} hint="Caption, post or article text. Up to 5,000 characters." />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Channel" name="channel" defaultValue="instagram">
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Campaign (optional)" name="campaignId" defaultValue="">
                <option value="">No campaign</option>
                {campaigns.map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.campaignName}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
              <Tag>Text only for now</Tag>
              Images, documents and video need storage and processing that are not built yet.
            </div>
          </InlineForm>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-serif text-2xl">How it works</h2>
            <ol className="mt-3 flex flex-col gap-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-purple-soft text-[13px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-[14px] text-text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <h2 className="font-serif text-2xl">Try it</h2>
            <p className="mt-2 text-[14px] text-text-muted">Paste this demo draft to see every risk level:</p>
            <p className="mt-2 rounded-control border border-border bg-surface/80 p-3 text-[14px]">{SAMPLE}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
