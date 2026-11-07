import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Reviews" };

export default async function Page({ params }: PageProps<"/org/[orgId]/reviews">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["reviews"]);
  return (
    <PlaceholderPage
      title={"Reviews"}
      description={"Work waiting for a decision."}
      specRef={"designPRD 4.8"}
      contents={["Queue with filters: risk, campaign, channel, assignee, due date, status, overdue", "Managers assign eligible reviewers; reviewers see their own assignments", "Deadlines and overdue flags"]}
    />
  );
}
