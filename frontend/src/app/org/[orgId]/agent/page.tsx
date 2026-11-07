import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "AI Agent Settings" };

export default async function Page({ params }: PageProps<"/org/[orgId]/agent">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["agent"]);
  return (
    <PlaceholderPage
      title={"AI Agent Settings"}
      description={"What the agent may do on its own."}
      specRef={"designPRD 4.6"}
      contents={["Autonomy per risk level: auto-fix (low), ask first (medium), recommend only (high, never auto-cleared)", "Agent action log with reasons and undo data"]}
    />
  );
}
