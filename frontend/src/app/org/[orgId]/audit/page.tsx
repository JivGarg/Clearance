import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Audit Log" };

export default async function Page({ params }: PageProps<"/org/[orgId]/audit">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["audit"]);
  return (
    <PlaceholderPage
      title={"Audit Log"}
      description={"Every decision, revision and agent action."}
      specRef={"designPRD 6; DataBasePRD 9"}
      contents={["Append-only timeline of approval decisions, revisions and agent actions", "Filters by actor, action and date"]}
    />
  );
}
