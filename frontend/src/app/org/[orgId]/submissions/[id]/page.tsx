import { FileText, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { RiskBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { releaseSubmissionAction } from "@/lib/actions/admin";
import { AGENT_ACTION_LABEL, getSubmission, orgSettings, type FindingView } from "@/lib/data/queries";
import { CHANNEL_LABEL } from "@/lib/domain";
import { formatDateTime, requestTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Submission" };

const DECISION_TEXT = { approved: "Approved", rejected: "Rejected", changes_requested: "Changes requested" } as const;

function Citation({ orgId, f }: { orgId: string; f: FindingView }) {
  if (!f.sourceTitle) return null;
  const href = f.sourceType === "embargo" ? orgPath(orgId, "embargoes") : orgPath(orgId, `knowledge/${f.sourceId}`);
  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[12px] font-medium text-text no-underline hover:border-accent/40 hover:bg-purple-soft"
    >
      <FileText aria-hidden className="size-3.5 shrink-0 text-accent" strokeWidth={2.25} />
      <span className="truncate">{f.sourceTitle}</span>
    </Link>
  );
}

/** designPRD 2.4 frame 3 / 4.5 / 4.8. Read-only for admins, apart from releasing approved work. */
export default async function SubmissionPage({ params }: PageProps<"/org/[orgId]/submissions/[id]">) {
  const { orgId, id } = await params;
  const { actor } = await requireOrg(orgId, PAGE_ROLES.submissions);
  const detail = getSubmission(actor, id);
  if (!detail) notFound(); // missing and "not yours" look the same (A12)
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const { submission: s, checks, revisions, decisions, assignments, agentActions } = detail;
  const [current, ...older] = checks;
  const currentIsLatest = current && current.revisionVersion === s.version;

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href={orgPath(orgId, "submissions")}>Back to submissions</Link>
      </p>
      <PageHeader
        title={s.intentSummary ?? "Untitled submission"}
        description={`${CHANNEL_LABEL[s.channel]} ${s.type} by ${s.creatorName}${s.campaignName ? ` for ${s.campaignName}` : ""} · version ${s.version}`}
        actions={
          detail.canRelease ? (
            <ActionButton
              action={releaseSubmissionAction}
              hidden={{ orgId, id: s.submissionId }}
              variant="primary"
              size="md"
              confirm={{ title: "Mark as released?", body: "This records that the approved version is published. Released content is final; changes need a new submission." }}
              confirmLabel="Mark released"
            >
              Mark as released
            </ActionButton>
          ) : undefined
        }
      />
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} />
          {s.risk ? <RiskBadge risk={s.risk} /> : null}
          {s.embargoHold ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-semibold text-danger-ink ring-1 ring-inset ring-danger-ink/20">
              <Lock aria-hidden className="size-3.5" />
              Embargo hold
            </span>
          ) : null}
        </div>
        {detail.releaseBlockedReason ? <p className="text-[14px] font-medium text-danger-ink">{detail.releaseBlockedReason}</p> : null}
        <DemoNotice />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-2xl">Findings</h2>
              {current ? <Tag>Mock check: {current.serviceUsed}</Tag> : null}
            </div>
            {!current ? (
              <p className="mt-2 text-[14px] text-text-muted">No check has run on this submission yet.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-text-muted">
                  Checked {formatDateTime(current.checkedAt, tz)} on version {current.revisionVersion ?? "?"}
                  {currentIsLatest ? "" : " (an older version; the current version has not been checked)"}. Rule-based mock, not an AI model.
                </p>
                {current.findings.length === 0 && current.restrictedCount === 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-[15px]">
                    <ShieldCheck aria-hidden className="size-5 text-success-ink" />
                    No issues found.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {current.findings.map((f) => (
                      <li key={f.issueId} className="rounded-control border border-border bg-surface/70 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge risk={f.riskLevel} />
                          <span className="font-semibold">{f.issueType}</span>
                        </div>
                        <p className="mt-2 text-[15px]">{f.explanation}</p>
                        {f.suggestedFix ? (
                          <p className="mt-2 text-[14px]">
                            <span className="font-semibold">Suggested fix: </span>
                            {f.suggestedFix}
                          </p>
                        ) : null}
                        <div className="mt-3">
                          <Citation orgId={orgId} f={f} />
                        </div>
                      </li>
                    ))}
                    {current.restrictedCount > 0 ? (
                      <li className="flex items-start gap-2 rounded-control border border-danger-ink/20 bg-danger-soft p-4 text-[15px] text-danger-ink">
                        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                        Restricted information requires internal review.
                      </li>
                    ) : null}
                  </ul>
                )}
              </>
            )}
            {older.length ? (
              <details className="mt-4 text-[14px]">
                <summary className="cursor-pointer font-medium text-accent">Earlier checks ({older.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {older.map((c) => (
                    <li key={c.checkId}>
                      {formatDateTime(c.checkedAt, tz)}: {c.riskLevel} risk, {c.findings.length} finding(s) on version {c.revisionVersion ?? "?"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card>
            <h2 className="font-serif text-2xl">Decisions</h2>
            {decisions.length ? (
              <ol className="mt-3 flex flex-col gap-3">
                {decisions.map((d) => (
                  <li key={d.decisionId} className="border-l-2 border-accent/40 pl-3">
                    <p className="font-semibold">
                      {DECISION_TEXT[d.decision]} by {d.reviewerName}
                      <span className="font-normal text-text-muted"> · version {d.revisionVersion ?? "?"}</span>
                    </p>
                    {d.comments ? <p className="text-[15px]">{d.comments}</p> : null}
                    <p className="text-[13px] text-text-muted">{formatDateTime(d.decidedAt, tz)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[14px] text-text-muted">No decision yet. Only an assigned reviewer can approve, reject or request changes.</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <h2 className="font-serif text-2xl">Reviewers</h2>
            {assignments.length ? (
              <ul className="mt-3 flex flex-col gap-2 text-[14px]">
                {assignments.map((x) => (
                  <li key={x.assignmentId} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{x.reviewerName}</span>
                    <span className="text-text-muted">
                      {x.status === "done" ? "Done" : x.deadline && Date.parse(x.deadline) < requestTime() ? "Overdue" : `Due ${formatDateTime(x.deadline, tz)}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-text-muted">Nobody assigned. Managers assign reviewers.</p>
            )}
          </Card>

          <Card>
            <h2 className="font-serif text-2xl">Versions</h2>
            <ol className="mt-3 flex flex-col gap-2 text-[14px]">
              {revisions.map((r) => (
                <li key={r.revisionId}>
                  <span className="font-semibold">v{r.version}</span> · {r.changeSummary ?? "No summary"}
                  <p className="text-[13px] text-text-muted">
                    {r.editorName}, {formatDateTime(r.createdAt, tz)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          {agentActions.length ? (
            <Card>
              <h2 className="font-serif text-2xl">Agent activity</h2>
              <ul className="mt-3 flex flex-col gap-2 text-[14px]">
                {agentActions.map((x) => (
                  <li key={x.actionId}>
                    <span className="font-semibold">{AGENT_ACTION_LABEL[x.action] ?? x.action}</span>: {x.reason}
                    <p className="text-[13px] text-text-muted">{formatDateTime(x.createdAt, tz)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-serif text-2xl">Processing disclosure</h2>
            <p className="mt-2 text-[14px]">
              Checked by <span className="font-semibold">{current?.serviceUsed ?? "nothing yet"}</span>, a local rule-based mock. No external AI provider received this
              content.
            </p>
            <p className="mt-2 break-all text-[13px] text-text-muted">Stored at {s.contentPath} (private storage path; file viewing arrives with Supabase Storage).</p>
          </Card>
        </div>
      </div>
    </>
  );
}
