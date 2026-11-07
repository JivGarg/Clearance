import type { ReactNode } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { ORGS } from "@/lib/demo-users";
import type { Membership, User } from "@/lib/domain";
import { navFor } from "@/lib/roles";

function Wordmark() {
  return (
    <p className="font-serif text-[28px] italic leading-none">
      Clearance<span className="text-accent">.</span>
    </p>
  );
}

/**
 * AppShell (designPRD 2.3): fixed-width glass sidebar with grouped navigation, glass top bar.
 * Below 1024px the sidebar becomes a drawer.
 */
export function AppShell({ user, membership, children }: { user: User; membership: Membership; children: ReactNode }) {
  const groups = navFor(membership.role);
  const myOrgs = ORGS.filter((o) => user.memberships.some((m) => m.orgId === o.id && m.status === "active"));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <aside className="hidden lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto border-r border-white/60 bg-sidebar/70 px-3 py-6 backdrop-blur-xl">
          <div className="px-3">
            <Wordmark />
          </div>
          <nav aria-label="Main">
            <NavLinks orgId={membership.orgId} groups={groups} />
          </nav>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="glass sticky top-0 z-20 flex items-center gap-3 border-x-0 border-t-0 px-4 py-3 lg:px-8">
          <MobileNav orgId={membership.orgId} groups={groups} />
          <div className="mr-auto min-w-0">
            <OrgSwitcher orgs={myOrgs} currentOrgId={membership.orgId} />
          </div>
          <RoleSwitcher currentUserId={user.id} className="hidden items-center gap-2 md:flex" />
          <NotificationsPanel />
          <UserMenu user={user} membership={membership} />
        </header>

        <main id="main" className="mx-auto w-full max-w-content px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <aside className="hidden border-r border-white/60 bg-sidebar/70 px-6 py-6 lg:block">
        <Wordmark />
      </aside>
      <div>
        <div className="glass h-16 border-x-0 border-t-0" />
        <main className="mx-auto w-full max-w-content px-4 py-8 lg:px-8">
          <p role="status" className="text-[14px] text-text-muted">
            Loading…
          </p>
        </main>
      </div>
    </div>
  );
}
