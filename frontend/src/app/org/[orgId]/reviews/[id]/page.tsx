import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Review" };

export default async function Page({ params }: PageProps<"/org/[orgId]/reviews/[id]">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["reviews"]);
  return (
    <PlaceholderPage
      title={"Review"}
      description={"Decide on one revision."}
      specRef={"designPRD 4.8; DataBasePRD 7"}
      contents={["Evidence for every finding next to the content", "Approve, reject with a reason, or request changes; the decision applies to the latest revision only", "Blocked while an embargo is active; no self-approval"]}
    />
  );
}
