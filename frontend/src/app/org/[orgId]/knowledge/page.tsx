import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Knowledge Base" };

// designPRD 2.4 (frame 5) and 4.2. Tabs mirror the knowledge tables in DataBasePRD 5.2.
const TABS = [
  { id: "guidelines", label: "Guidelines", title: "No guidelines yet", description: "Versioned brand rules with category and version (brand_guidelines)." },
  { id: "facts", label: "Approved facts", title: "No approved facts yet", description: "Facts with source, expiry and confidentiality. Expired facts are never used by checks." },
  { id: "assets", label: "Assets", title: "No assets yet", description: "Logos and images with their visibility class. Files stay in private storage." },
];

export default async function KnowledgePage({ params }: PageProps<"/org/[orgId]/knowledge">) {
  const { orgId } = await params;
  const { membership } = await requireOrg(orgId, PAGE_ROLES.knowledge);
  const filtered = membership.role === "creator";

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description={
          filtered
            ? "Brand rules and facts you are allowed to see. Confidential items are not shown to creators."
            : "Everything checks are measured against: guidelines, approved facts and assets."
        }
      />
      <Tabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, content: <EmptyState title={t.title} description={t.description} /> }))}
      />
    </>
  );
}
