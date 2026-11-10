import { FileText, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineForm } from "@/components/forms/inline-form";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { ContentCard, DiffCard, IntentView } from "@/components/submissions/content-views";
import { RiskBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { assignReviewerAction, decideAction } from "@/lib/actions/workflow";
import { eligibleReviewers, getSubmission, orgSettings } from "@/lib/data/queries";
import { db } from "@/lib/data/store";
import { CHANNEL_LABEL } from "@/lib/domain";
import { formatDateTime, requestTime } from "@/lib/format";
import { PAGE_ROLES, orgPath } from "@/lib/roles";
import { requireOrg } from "@/lib/session";

export const metadata: Metadata = { title: "Review" };

/** Approval, rejection, change requests (designPRD 2.4 frame 3, 4.8). Reviewers decide; managers assign. */
export default async function ReviewPage({ params }: PageProps<"/org/[orgId]/reviews/[id]">) {
  const { orgId, id } = await params;
  const { actor, membership } = await requireOrg(orgId, PAGE_ROLES.reviews);
  const detail = getSubmission(actor, id);
  if (!detail) notFound();
  const { submission: s, checks, revisions, assignments, decisions } = detail;
  const raw = db().submissions.find((x) => x.submissionId === id)!;
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const now = requestTime();
  const [latest, previous] = revisions;
  const current = checks[0];
  const currentIsLatest = !!current && current.revisionId === latest?.revisionId;
  const myOpen = assignments.find((x) => x.reviewerUserId === actor.userId && x.status !== "done");
  const canDecide = membership.role === "reviewer" && s.status === "in_review" && !!myOpen && s.createdByUserId !== actor.userId;
  const isManager = membership.role === "manager";
  const open = assignments.filter((x) => x.status !== "done");
  const pool = isManager && s.status === "in_review" ? eligibleReviewers(actor, raw) : [];
  const hidden = { orgId, id };

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href={orgPath(orgId, "reviews")}>Back to reviews</Link>
      </p>
      <PageHeader title={s.intentSummary ?? "Untitled submission"} description={`${CHANNEL_LABEL[s.channel]} ${s.type} by ${s.creatorName}${s.campaignName ? ` for ${s.campaignName}` : ""} · version ${s.version}`} />
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
          <Link href={orgPath(orgId, `submissions/${id}`)} className="text-[14px]">
            Full history
          </Link>
        </div>
        <DemoNotice />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {latest ? <ContentCard version={latest.version} content={latest.content} /> : null}
          {latest && previous ? <DiffCard fromVersion={previous.version} toVersion={latest.version} before={previous.content} after={latest.content} /> : null}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-2xl">Findings</h2>
              {current ? <Tag>Mock check: {current.serviceUsed}</Tag> : null}
            </div>
            {!current ? (
              <p className="mt-2 text-[14px] text-text-muted">No check has run.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-text-muted">
                  On version {current.revisionVersion ?? "?"}
                  {currentIsLatest ? "" : ": not the version you are reviewing; read the text carefully"}. Rule-based mock, not an AI model.
                </p>
                {current.findings.length ? (
                  <ul className="mt-3 flex flex-col gap-3">
                    {current.findings.map((f) => (
                      <li key={f.issueId} className="rounded-control border border-border bg-surface/70 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge risk={f.riskLevel} />
                          <span className="font-semibold">{f.issueType}</span>
                        </div>
                        <p className="mt-2 text-[15px]">{f.explanation}</p>
                        {f.suggestedFix ? <p className="mt-1 text-[14px]">Suggested: {f.suggestedFix}</p> : null}
                        {f.sourceTitle ? (
                          <Link
                            href={f.sourceType === "embargo" ? orgPath(orgId, "embargoes") : orgPath(orgId, `knowledge/${f.sourceId}`)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[12px] font-medium text-text no-underline hover:bg-purple-soft"
                          >
                            <FileText aria-hidden className="size-3.5 text-accent" />
                            {f.sourceTitle}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[15px]">No issues found.</p>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {canDecide ? (
            <Card>
              <h2 className="font-serif text-2xl">Your decision</h2>
              <p className="mt-1 text-[13px] text-text-muted">Applies to version {s.version} only. If the text changes, it needs a new review.</p>
              <div className="mt-3">
                <InlineForm action={decideAction} hidden={hidden} ariaLabel="Review decision" submitLabel="Record decision">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[13px] font-semibold">Decision</legend>
                    {(
                      [
                        ["approved", "Approve", s.embargoHold ? "Not available: cites an active embargo." : "Cleared for publishing."],
                        ["changes_requested", "Request changes", "The creator revises and resubmits."],
                        ["rejected", "Reject", "Final. The creator must start again."],
                      ] as const
                    ).map(([value, label, help]) => (
                      <label key={value} className="flex cursor-pointer items-start gap-2 rounded-control border border-border bg-surface/70 p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                        <input type="radio" name="decision" value={value} disabled={value === "approved" && s.embargoHold} defaultChecked={value === "changes_requested"} className="mt-1 size-4 accent-[var(--color-accent)]" />
                        <span>
                          <span className="block font-semibold">{label}</span>
                          <span className="block text-[13px] text-text-muted">{help}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <TextAreaField label="Comments" name="comments" rows={4} maxLength={2000} hint="Required when rejecting or requesting changes. The creator sees this." />
                </InlineForm>
              </div>
            </Card>
          ) : membership.role === "reviewer" ? (
            <Card>
              <h2 className="font-serif text-2xl">Your decision</h2>
              <p className="mt-2 text-[14px] text-text-muted">{s.status === "in_review" ? "This is not assigned to you." : "Already decided."}</p>
            </Card>
          ) : null}

          {isManager ? (
            <Card>
              <h2 className="font-serif text-2xl">Reviewer</h2>
              {open.length ? (
                <ul className="mt-2 flex flex-col gap-1 text-[14px]">
                  {open.map((x) => (
                    <li key={x.assignmentId}>
                      <span className="font-medium">{x.reviewerName}</span>
                      <span className="text-text-muted"> · {x.deadline && Date.parse(x.deadline) < now ? "Overdue" : `due ${formatDateTime(x.deadline, tz)}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[14px] text-text-muted">Nobody assigned.</p>
              )}
              {s.status === "in_review" ? (
                pool.length ? (
                  <div className="mt-4">
                    <InlineForm action={assignReviewerAction} hidden={hidden} ariaLabel="Assign reviewer" submitLabel={open.length ? "Reassign" : "Assign"}>
                      <SelectField label="Reviewer" name="reviewerUserId" defaultValue={pool[0].userId} hint="Active reviewers who did not create this content.">
                        {pool.map((r) => (
                          <option key={r.userId} value={r.userId}>
                            {r.name} ({r.open} open)
                          </option>
                        ))}
                      </SelectField>
                    </InlineForm>
                  </div>
                ) : (
                  <p className="mt-3 text-[14px] text-danger-ink">No eligible reviewer. Ask an admin to add one.</p>
                )
              ) : null}
            </Card>
          ) : null}

          <Card>
            <h2 className="font-serif text-2xl">Intent</h2>
            {raw.intent ? <IntentView intent={raw.intent} /> : <p className="mt-2 text-[15px]">{s.intentSummary ?? "No intent recorded."}</p>}
          </Card>

          {decisions.length ? (
            <Card>
              <h2 className="font-serif text-2xl">Earlier decisions</h2>
              <ul className="mt-3 flex flex-col gap-2 text-[14px]">
                {decisions.map((d) => (
                  <li key={d.decisionId}>
                    <span className="font-semibold">{d.decision.replace("_", " ")}</span> by {d.reviewerName} on v{d.revisionVersion ?? "?"}
                    {d.comments ? `: ${d.comments}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
