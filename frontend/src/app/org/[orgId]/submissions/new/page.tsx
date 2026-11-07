import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Submit new content" };

export default async function Page({ params }: PageProps<"/org/[orgId]/submissions/new">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["submissions/new"]);
  return (
    <PlaceholderPage
      title={"Submit new content"}
      description={"Upload a draft for checking."}
      specRef={"designPRD 2.4 (frame 2), 4.3"}
      contents={["Large upload dropzone; supported types: text, image, document, video", "Channel, campaign (optional), content type and intended publish date", "Process steps: upload, intent confirmation, checks, review", "Signed upload to private storage; type and size validated on the server"]}
    />
  );
}
