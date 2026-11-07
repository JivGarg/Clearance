import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Embargoes" };

export default async function Page({ params }: PageProps<"/org/[orgId]/embargoes">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["embargoes"]);
  return (
    <PlaceholderPage
      title={"Embargoes"}
      description={"Restricted items and their release dates."}
      specRef={"designPRD 4.9"}
      contents={["Restricted item, release date, visibility class", "Clearance is blocked while active; at expiry the draft is requeued for review, never auto-approved"]}
    />
  );
}
