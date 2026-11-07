import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { markNotificationReadAction } from "@/lib/actions/admin";
import { listNotifications, orgSettings } from "@/lib/data/queries";
import { db } from "@/lib/data/store";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Notifications" };

/** In-app notifications (designPRD 3, 4.8). Your own only; links go to this company's submissions. */
export default async function NotificationsPage({ params }: PageProps<"/org/[orgId]/notifications">) {
  const { orgId } = await params;
  const { user } = await requireOrg(orgId, PAGE_ROLES.notifications);
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const subs = db().submissions;
  // Only this company's notifications on this page (a person may belong to several).
  const items = listNotifications(user.id).filter((n) => !n.submissionId || subs.find((s) => s.submissionId === n.submissionId)?.organizationId === orgId);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread ? (
            <ActionButton action={markNotificationReadAction} hidden={{ id: "all" }} size="md">
              Mark all as read
            </ActionButton>
          ) : undefined
        }
      />
      <div className="mb-6">
        <DemoNotice extra="Email notifications are a later extension." />
      </div>
      {items.length ? (
        <ul className="glass flex flex-col rounded-card">
          {items.map((n) => (
            <li key={n.notificationId} className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4 last:border-0", !n.readAt && "bg-purple-soft/50")}>
              <div className="min-w-0">
                <p className={cn("text-[15px]", !n.readAt && "font-semibold")}>
                  {!n.readAt ? <span className="sr-only">Unread: </span> : null}
                  {n.message}
                </p>
                <p className="text-[13px] text-text-muted">
                  {formatDateTime(n.createdAt, tz)}
                  {n.submissionId ? (
                    <>
                      {" · "}
                      <Link href={orgPath(orgId, `submissions/${n.submissionId}`)}>Open submission</Link>
                    </>
                  ) : null}
                </p>
              </div>
              {!n.readAt ? (
                <ActionButton action={markNotificationReadAction} hidden={{ id: n.notificationId }} variant="ghost" silent ariaLabel={`Mark as read: ${n.message}`}>
                  Mark read
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No notifications" description="Assignments, revision requests, clearances and embargo releases will appear here." />
      )}
    </>
  );
}
