import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/session";

/**
 * Everything inside a company. The session and the URL's company are checked in a child component
 * inside <Suspense> (Cache Components). No active membership in this company: redirected away.
 * This is a UX guard; row-level security in Postgres is the real one.
 */
async function OrgShell({ params, children }: { params: Promise<{ orgId: string }>; children: ReactNode }) {
  const { orgId } = await params;
  const { user, membership } = await requireOrg(orgId);
  return (
    <AppShell user={user} membership={membership}>
      {children}
    </AppShell>
  );
}

export default function OrgLayout({ children, params }: LayoutProps<"/org/[orgId]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <OrgShell params={params}>{children}</OrgShell>
    </Suspense>
  );
}
