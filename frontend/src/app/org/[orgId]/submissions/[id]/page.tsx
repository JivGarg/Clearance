import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Submission" };

export default async function Page({ params }: PageProps<"/org/[orgId]/submissions/[id]">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["submissions"]);
  return (
    <PlaceholderPage
      title={"Submission"}
      description={"Details, findings, revisions and comparison."}
      specRef={"designPRD 2.4 (frame 3), 4.3, 4.7"}
      contents={["Confirm or edit the proposed intent: goal, audience, key message, call to action", "Findings with risk, explanation and a citation to the exact source version", "Side-by-side original and suggested versions; accept or reject each change", "Revision history; restricted findings shown only as \"Restricted information requires internal review\""]}
    />
  );
}
