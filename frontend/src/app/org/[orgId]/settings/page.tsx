import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page({ params }: PageProps<"/org/[orgId]/settings">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["settings"]);
  return (
    <PlaceholderPage
      title={"Settings"}
      description={"Company settings."}
      specRef={"designPRD 4.1"}
      contents={["Company name and timezone", "Integrations (future)"]}
    />
  );
}
