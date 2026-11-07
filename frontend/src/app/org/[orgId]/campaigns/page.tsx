import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Campaigns" };

export default async function Page({ params }: PageProps<"/org/[orgId]/campaigns">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["campaigns"]);
  return (
    <PlaceholderPage
      title={"Campaigns"}
      description={"Group submissions and compare channels."}
      specRef={"designPRD 4.10"}
      contents={["Campaign list with date ranges", "Cross-channel comparison of claims (offer, price, dates)", "Conflicting posts linked side by side with the approved fact, or a clarification request"]}
    />
  );
}
