"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { Drawer } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

/** NotificationBell (designPRD 2.3). Data arrives with Supabase (notifications table). */
export function NotificationsPanel({ unreadCount = 0 }: { unreadCount?: number }) {
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
        <EmptyState
          title="Nothing new"
          description="Assignments, revision requests, clearances and embargo releases will appear here."
        />
      </Drawer>
    </>
  );
}
