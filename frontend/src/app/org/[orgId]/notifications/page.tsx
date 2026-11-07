import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page({ params }: PageProps<"/org/[orgId]/notifications">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["notifications"]);
  return (
    <PlaceholderPage
      title={"Notifications"}
      description={"Everything addressed to you."}
      specRef={"designPRD 4.8"}
      contents={["Assignments, revision requests, clearances, embargo releases, overdue reviews", "Mark as read"]}
    />
  );
}
