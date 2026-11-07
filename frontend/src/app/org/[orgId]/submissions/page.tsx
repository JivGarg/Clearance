import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Submissions" };

export default async function Page({ params }: PageProps<"/org/[orgId]/submissions">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["submissions"]);
  return (
    <PlaceholderPage
      title={"Submissions"}
      description={"Every submission you are allowed to see."}
      specRef={"designPRD 3, 4.3"}
      contents={["Searchable list with filters: status, channel, campaign, content type, date", "Role-aware: creators see their own work, reviewers what is assigned to them, admins and managers everything", "Status and highest risk visible on every row", "Pagination and sorting"]}
    />
  );
}
