"use client";

import {
  BookOpen,
  Bot,
  ChartColumn,
  CircleCheckBig,
  FileText,
  History,
  LayoutDashboard,
  Layers,
  Bell,
  Lock,
  Plug,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { orgPath, type NavGroup, type NavIcon } from "@/lib/roles";

// Server components pass icon names; components cannot cross the server/client boundary.
const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  file: FileText,
  check: CircleCheckBig,
  book: BookOpen,
  chart: ChartColumn,
  users: Users,
  bot: Bot,
  plug: Plug,
  settings: Settings,
  history: History,
  bell: Bell,
  layers: Layers,
  lock: Lock,
};

export function NavLinks({
  orgId,
  groups,
  onNavigate,
}: {
  orgId: string;
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              if (item.disabled) {
                return (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-control px-3 text-[14px] text-text-muted/70"
                    >
                      <Icon aria-hidden className="size-[18px] shrink-0" />
                      {item.label}
                      <span className="ml-auto rounded-full bg-surface-muted px-2 text-[11px] font-medium text-text-muted">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              const href = orgPath(orgId, item.page);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={item.label}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-control px-3 text-[14px] font-medium no-underline transition-colors",
                      active
                        ? "bg-surface text-accent shadow-[var(--shadow-card)]"
                        : "text-text hover:bg-surface/60",
                    )}
                  >
                    <Icon aria-hidden className="size-[18px] shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
