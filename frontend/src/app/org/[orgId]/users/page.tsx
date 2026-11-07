import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Users & Roles" };

export default async function Page({ params }: PageProps<"/org/[orgId]/users">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["users"]);
  return (
    <PlaceholderPage
      title={"Users & Roles"}
      description={"Members, roles and invitations."}
      specRef={"designPRD 2.4 (frame 6), 4.1"}
      contents={["Role totals", "Member table: role, status", "Invite, change role, suspend; history stays attributed"]}
    />
  );
}
