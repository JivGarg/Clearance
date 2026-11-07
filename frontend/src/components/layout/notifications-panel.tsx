"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

export interface BellItem {
  id: string;
  message: string;
  when: string;
  href: string | null;
  unread: boolean;
}

/** NotificationBell (designPRD 2.3): unread count and the latest few; full list on the page. */
export function NotificationsPanel({ unreadCount = 0, items = [], allHref }: { unreadCount?: number; items?: BellItem[]; allHref: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Notifications, ${unreadCount} unread`}
        className="glass relative grid size-10 shrink-0 place-items-center rounded-control"
      >
        <Bell aria-hidden className="size-[18px]" />
        {unreadCount > 0 ? (
          <span aria-hidden className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications">
        {items.length ? (
          <ul className="flex flex-col gap-2">
            {items.map((n) => (
              <li key={n.id} className={cn("rounded-control border border-border p-3", n.unread ? "bg-purple-soft/60" : "bg-surface/70")}>
                <p className={cn("text-[14px]", n.unread && "font-semibold")}>
                  {n.unread ? <span className="sr-only">Unread: </span> : null}
                  {n.href ? (
                    <Link href={n.href} onClick={() => setOpen(false)} className="text-text">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </p>
                <p className="text-[12px] text-text-muted">{n.when}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing new" description="Assignments, revision requests, clearances and embargo releases will appear here." />
        )}
        <p className="mt-4 text-[14px]">
          <Link href={allHref} onClick={() => setOpen(false)}>
            All notifications
          </Link>
        </p>
      </Drawer>
    </>
  );
}
