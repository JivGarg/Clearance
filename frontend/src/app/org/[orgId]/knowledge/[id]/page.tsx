import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Source" };

export default async function Page({ params }: PageProps<"/org/[orgId]/knowledge/[id]">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["knowledge"]);
  return (
    <PlaceholderPage
      title={"Source"}
      description={"One knowledge item and its versions."}
      specRef={"designPRD 4.2"}
      contents={["Source details, owner, effective dates, classification", "Version history; only approved, current versions are used for checks"]}
    />
  );
}
