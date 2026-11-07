import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PAGE_ROLES } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function Page({ params }: PageProps<"/org/[orgId]/analytics">) {
  const { orgId } = await params;
  await requireOrg(orgId, PAGE_ROLES["analytics"]);
  return (
    <PlaceholderPage
      title={"Analytics"}
      description={"Insights from real data only."}
      specRef={"designPRD 2.4 (frame 4), 4.11"}
      contents={["KPIs: submissions, cleared, in review, high-risk holds, review time, auto-fix count", "Charts: submissions vs cleared, risk distribution, top issue categories", "Filters and CSV export; zero denominators show N/A, never fabricated trends"]}
    />
  );
}
