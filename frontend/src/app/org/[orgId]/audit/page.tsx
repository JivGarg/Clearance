import type { Metadata } from "next";
import Link from "next/link";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Tag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { auditTimeline, orgSettings, type AuditKind } from "@/lib/data/queries";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Audit Log" };

const KINDS: { id: AuditKind | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "decision", label: "Decisions" },
  { id: "revision", label: "Versions" },
  { id: "check", label: "Checks" },
  { id: "agent", label: "Agent" },
  { id: "admin", label: "Admin changes" },
];
const PAGE_SIZE = 25;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Audit timeline (designPRD 3, 6). Decisions, versions, checks and agent actions come from append-only tables. */
export default async function AuditPage({ params, searchParams }: PageProps<"/org/[orgId]/audit">) {
  const { orgId } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.audit);
  const sp = await searchParams;
  const kind = KINDS.some((k) => k.id === one(sp.kind) && k.id !== "all") ? (one(sp.kind) as AuditKind) : undefined;
  const entries = auditTimeline(actor, kind);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const shown = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const href = (k: string, p = 1) => orgPath(orgId, `audit?${new URLSearchParams({ ...(k !== "all" ? { kind: k } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`);

  return (
    <>
      <PageHeader title="Audit Log" description="Who did what, and when. Decisions, versions and agent actions cannot be edited or deleted, even by the system." />
      <div className="mb-6">
        <DemoNotice extra='Entries marked "Not in database yet" have no audit table in the schema yet.' />
      </div>

      <nav aria-label="Filter by type" className="glass mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-full p-1">
        {KINDS.map((k) => {
          const active = (kind ?? "all") === k.id;
          return (
            <Link
              key={k.id}
              href={href(k.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full px-4 text-[14px] font-medium no-underline",
                active ? "bg-accent text-white" : "text-text-muted hover:bg-surface hover:text-text",
              )}
            >
              {k.label}
            </Link>
          );
        })}
      </nav>

      {shown.length ? (
        <ol className="glass flex flex-col rounded-card">
          {shown.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="grid gap-1 border-b border-border/70 px-5 py-4 last:border-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <time dateTime={e.at} className="text-[13px] text-text-muted">
                {formatDateTime(e.at, tz)}
              </time>
              <div className="min-w-0">
                <p className="text-[15px]">
                  <span className="font-semibold">{e.actor}</span> · {e.summary}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-text-muted">{KINDS.find((k) => k.id === e.kind)?.label}</span>
                  {e.submissionId ? <Link href={orgPath(orgId, `submissions/${e.submissionId}`)}>View submission</Link> : null}
                  {e.demoOnly ? <Tag>Not in database yet</Tag> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing recorded" description={kind === "admin" ? "Admin changes made in this session appear here." : "Activity will appear here as it happens."} />
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-[14px]">
          {page > 1 ? <Link href={href(kind ?? "all", page - 1)}>Newer</Link> : <span />}
          <span className="text-text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(kind ?? "all", page + 1)}>Older</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}
