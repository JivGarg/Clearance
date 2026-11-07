import { Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag, VisibilityBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextField } from "@/components/ui/field";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { releaseEmbargoAction, saveEmbargoAction } from "@/lib/actions/admin";
import { citationsOf, isActiveEmbargo, listEmbargoes, orgSettings } from "@/lib/data/queries";
import type { EmbargoRow } from "@/lib/data/types";
import { VISIBILITY_CLASSES, VISIBILITY_LABEL } from "@/lib/domain";
import { formatDateTime, relative, requestTime, toLocalInput } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Embargoes" };

function EmbargoFields({ e, tz }: { e?: EmbargoRow; tz: string }) {
  return (
    <>
      <TextField label="Restricted item" name="item" defaultValue={e?.restrictedItem} required maxLength={200} hint="Product, codename or fact that must not appear before release." />
      <TextField label="Release time" name="releaseAt" type="datetime-local" defaultValue={toLocalInput(e?.releaseAt ?? null, tz)} required hint={`In ${tz}.`} />
      <SelectField label="Visibility" name="visibility" defaultValue={e?.visibility ?? "confidential"} hint="Confidential embargoes are never shown to creators; their findings read “Restricted information requires internal review.”">
        {VISIBILITY_CLASSES.map((v) => (
          <option key={v} value={v}>
            {VISIBILITY_LABEL[v]}
          </option>
        ))}
      </SelectField>
    </>
  );
}

/** Confidential items and release dates (designPRD 3, 4.9). Admins and managers edit. */
export default async function EmbargoesPage({ params }: PageProps<"/org/[orgId]/embargoes">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.embargoes);
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const now = requestTime();
  const rows = listEmbargoes(actor).map((e) => {
    const held = citationsOf(actor, e.embargoId).filter(({ submission }) => submission.status === "in_review" || submission.status === "changes_requested");
    return { e, active: isActiveEmbargo(e, now), held };
  });
  const hidden = { orgId };

  return (
    <>
      <PageHeader
        title="Embargoes"
        description="Nothing citing an active embargo can be approved or released. Lifting one never approves anything: held work stays in review."
        actions={
          <FormDialog triggerLabel="Add embargo" triggerIcon={<Plus aria-hidden className="size-4" />} title="Add embargo" action={saveEmbargoAction} hidden={hidden} submitLabel="Add embargo">
            <EmbargoFields tz={tz} />
          </FormDialog>
        }
      />
      <div className="mb-6">
        <DemoNotice />
      </div>
      {rows.length ? (
        <Table caption="Embargoes">
          <thead>
            <tr>
              <Th>Restricted item</Th>
              <Th>Visibility</Th>
              <Th>Release</Th>
              <Th>Holding</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, active, held }) => (
              <Tr key={e.embargoId}>
                <Td className="min-w-48 font-semibold">{e.restrictedItem}</Td>
                <Td>
                  <VisibilityBadge value={e.visibility} />
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDateTime(e.releaseAt, tz)}
                  <p className="text-[12px] text-text-muted">{active ? `Lifts ${relative(e.releaseAt, now)}` : "Released"}</p>
                </Td>
                <Td>
                  {held.length ? (
                    <ul className="flex flex-col gap-0.5 text-[13px]">
                      {held.map(({ submission }) => (
                        <li key={submission.submissionId}>
                          <Link href={orgPath(orgId, `submissions/${submission.submissionId}`)}>{submission.intentSummary ?? "Submission"}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : active ? (
                    <span className="text-[13px] text-text-muted">Nothing</span>
                  ) : (
                    <Tag>Released</Tag>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <FormDialog triggerLabel="Edit" triggerIcon={<Pencil aria-hidden className="size-3.5" />} triggerVariant="ghost" triggerSize="sm" triggerAriaLabel={`Edit embargo: ${e.restrictedItem}`} title="Edit embargo" action={saveEmbargoAction} hidden={{ ...hidden, id: e.embargoId }}>
                      <EmbargoFields e={e} tz={tz} />
                    </FormDialog>
                    {active ? (
                      <ActionButton
                        action={releaseEmbargoAction}
                        hidden={{ ...hidden, id: e.embargoId }}
                        variant="ghost"
                        ariaLabel={`Lift embargo now: ${e.restrictedItem}`}
                        confirm={{
                          title: "Lift this embargo now?",
                          body: `"${e.restrictedItem}" becomes public information for checks. ${held.length} held submission(s) stay in review until a reviewer decides.`,
                        }}
                        confirmLabel="Lift now"
                      >
                        Lift now
                      </ActionButton>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No embargoes" description="Add unreleased products, codenames or dates so checks can hold content that mentions them." />
      )}
    </>
  );
}
