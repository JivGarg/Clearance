import type { Metadata } from "next";
import { InlineForm } from "@/components/forms/inline-form";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { saveOrgSettingsAction } from "@/lib/actions/admin";
import { orgRow, orgSettings } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/format";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/** Organisation settings (designPRD 3, 4.1): name and default timezone. Admin only. */
export default async function SettingsPage({ params }: PageProps<"/org/[orgId]/settings">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES.settings);
  const org = orgRow(orgId);
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const zones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <PageHeader title="Settings" description="Company details used across Clearance." />
      <div className="mb-6">
        <DemoNotice extra="The timezone has no database column yet." />
      </div>
      <Card className="max-w-2xl">
        <InlineForm action={saveOrgSettingsAction} hidden={{ orgId }} ariaLabel="Company settings">
          <TextField label="Company name" name="companyName" defaultValue={org?.companyName} required maxLength={120} />
          <SelectField label="Default timezone" name="timezone" defaultValue={tz} hint="Dates, deadlines and embargo release times are shown and entered in this timezone.">
            {(zones.includes("UTC") ? zones : ["UTC", ...zones]).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>
          {org ? <p className="text-[13px] text-text-muted">Last changed {formatDateTime(org.updatedAt, tz)}</p> : null}
        </InlineForm>
      </Card>
    </>
  );
}
