import { CircleCheck, Circle, FileText, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { InlineForm } from "@/components/forms/inline-form";
import { DemoNotice } from "@/components/layout/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { ContentCard, DiffCard, IntentView } from "@/components/submissions/content-views";
import { RiskBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/field";
import { releaseSubmissionAction } from "@/lib/actions/admin";
import { applyFixesAction, confirmIntentAction, reviseAction, runCheckAction, sendForReviewAction } from "@/lib/actions/workflow";
import { AGENT_ACTION_LABEL, getSubmission, orgSettings, type FindingView } from "@/lib/data/queries";
import { db } from "@/lib/data/store";
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

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="flex items-start gap-2 text-[15px]">
      <Icon aria-hidden className={done ? "mt-0.5 size-5 shrink-0 text-success-ink" : "mt-0.5 size-5 shrink-0 text-text-muted"} />
      <span>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {children}
      </span>
    </li>
  );
}

/** Excerpt around a finding's span in the checked text: "…before [match] after…". */
function excerpt(text: string, start: number, end: number) {
  const a = Math.max(0, start - 30);
  const b = Math.min(text.length, end + 30);
  return { before: `${a > 0 ? "…" : ""}${text.slice(a, start)}`, match: text.slice(start, end), after: `${text.slice(end, b)}${b < text.length ? "…" : ""}` };
}

/** designPRD 2.4 frame 3 / 4.3 / 4.5 / 4.7 / 4.8. Creators work their draft here; others view. */
export default async function SubmissionPage({ params }: PageProps<"/org/[orgId]/submissions/[id]">) {
  const { orgId, id } = await params;
  const { actor, membership } = await requireOrg(orgId, PAGE_ROLES.submissions);
  const detail = getSubmission(actor, id);
  if (!detail) notFound(); // missing and "not yours" look the same (A12)
  const tz = orgSettings(orgId)?.timezone ?? "UTC";
  const now = requestTime();
  const { submission: s, checks, revisions, decisions, assignments, agentActions } = detail;
  const raw = db().submissions.find((x) => x.submissionId === id)!;
  const [latest, previous] = revisions;
  const [current, ...older] = checks;
  const currentIsLatest = !!current && current.revisionId === latest?.revisionId;
  const isOwner = membership.role === "creator" && s.createdByUserId === actor.userId;
  const editable = isOwner && (s.status === "draft" || s.status === "changes_requested");
  const canRevise = isOwner && s.status !== "rejected" && s.status !== "released";
  const lastDecision = decisions[0];
  const needsNewVersion = s.status === "changes_requested" && !!lastDecision && !!latest && latest.createdAt <= lastDecision.decidedAt;
  const fixable = editable && currentIsLatest ? current.findings.filter((f) => f.suggestedFix !== null && f.spanStart !== undefined && f.spanEnd !== undefined) : [];
  const hidden = { orgId, id };
  const canOpenReview = s.status === "in_review" && (membership.role === "manager" || (membership.role === "reviewer" && assignments.some((x) => x.reviewerUserId === actor.userId && x.status !== "done")));

  const findingsList = current ? (
    <ul className="mt-4 flex flex-col gap-3">
      {current.findings.map((f) => {
        const canPick = fixable.includes(f);
        const ex = canPick && latest && f.rule !== "ad-disclosure" ? excerpt(latest.content, f.spanStart!, f.spanEnd!) : null;
        return (
          <li key={f.issueId} className="rounded-control border border-border bg-surface/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={f.riskLevel} />
              <span className="font-semibold">{f.issueType}</span>
            </div>
            <p className="mt-2 text-[15px]">{f.explanation}</p>
            {ex ? (
              <div className="mt-2 grid gap-1 text-[14px] sm:grid-cols-[6rem_minmax(0,1fr)]">
                <span className="font-semibold">Original</span>
                <span className="break-words">
                  {ex.before}
                  <del className="rounded bg-danger-soft px-0.5 text-danger-ink">{ex.match}</del>
                  {ex.after}
                </span>
                <span className="font-semibold">Suggested</span>
                <span className="break-words">
                  <ins className="rounded bg-success-soft px-0.5 text-success-ink underline">{f.suggestedFix}</ins>
                </span>
              </div>
            ) : f.suggestedFix ? (
              <p className="mt-2 text-[14px]">
                <span className="font-semibold">Suggested fix: </span>
                {f.suggestedFix}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Citation orgId={orgId} f={f} />
              {canPick ? (
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[14px] font-medium">
                  <input type="checkbox" name="fix" value={f.issueId} className="size-5 accent-[var(--color-accent)]" />
                  Accept this fix
                </label>
              ) : null}
            </div>
          </li>
        );
      })}
      {current.restrictedCount > 0 ? (
        <li className="flex items-start gap-2 rounded-control border border-danger-ink/20 bg-danger-soft p-4 text-[15px] text-danger-ink">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          Restricted information requires internal review.
        </li>
      ) : null}
    </ul>
  ) : null;

  return (
    <>
      <p className="mb-2 text-[14px]">
        <Link href={orgPath(orgId, "submissions")}>Back to submissions</Link>
      </p>
      <PageHeader
        title={s.intentSummary ?? "Untitled submission"}
        description={`${CHANNEL_LABEL[s.channel]} ${s.type} by ${s.creatorName}${s.campaignName ? ` for ${s.campaignName}` : ""} · version ${s.version}`}
        actions={
          <>
            {canOpenReview ? <ButtonLink href={orgPath(orgId, `reviews/${id}`)}>Open review</ButtonLink> : null}
            {canRevise && latest ? (
              <FormDialog
                triggerLabel="Edit text"
                triggerVariant="secondary"
                title="Edit text"
                description={s.status === "approved" ? "Editing approved content sends it back to review: the approval does not carry over." : "Saves a new version. Earlier versions are kept."}
                action={reviseAction}
                hidden={hidden}
                submitLabel="Save new version"
              >
                <TextAreaField label="Text" name="content" defaultValue={latest.content} rows={8} required maxLength={5000} />
                <TextField label="What changed (optional)" name="summary" maxLength={200} />
              </FormDialog>
            ) : null}
            {detail.canRelease ? (
              <ActionButton
                action={releaseSubmissionAction}
                hidden={hidden}
                variant="primary"
                size="md"
                confirm={{ title: "Mark as released?", body: "This records that the approved version is published. Released content is final; changes need a new submission." }}
                confirmLabel="Mark released"
              >
                Mark as released
              </ActionButton>
            ) : null}
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} />
          {s.risk ? <RiskBadge risk={s.risk} /> : null}
          {s.embargoHold && membership.role !== "creator" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-[12px] font-semibold text-danger-ink ring-1 ring-inset ring-danger-ink/20">
              <Lock aria-hidden className="size-3.5" />
              Embargo hold
            </span>
          ) : null}
        </div>
        {detail.releaseBlockedReason ? <p className="text-[14px] font-medium text-danger-ink">{detail.releaseBlockedReason}</p> : null}
        <DemoNotice />
      </div>

      {editable ? (
        <Card className="mb-6">
          <h2 className="font-serif text-2xl">{s.status === "changes_requested" ? "Changes requested" : "Next steps"}</h2>
          {s.status === "changes_requested" && lastDecision?.comments ? (
            <p className="mt-2 rounded-control border border-warning-ink/20 bg-warning-soft p-3 text-[15px] text-warning-ink">
              <span className="font-semibold">{lastDecision.reviewerName}: </span>
              {lastDecision.comments}
            </p>
          ) : null}
          <ol className="mt-3 flex flex-col gap-2">
            {s.status === "changes_requested" ? <Step done={!needsNewVersion}>Upload a new version that addresses the comments</Step> : null}
            <Step done={currentIsLatest}>Check the current version</Step>
            <Step done={raw.intentConfirmed}>Confirm the intent</Step>
            <Step done={false}>Send for review</Step>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {!currentIsLatest ? (
              <ActionButton action={runCheckAction} hidden={hidden} variant="primary" size="md">
                Run check
              </ActionButton>
            ) : null}
            <ActionButton action={sendForReviewAction} hidden={hidden} variant={currentIsLatest && raw.intentConfirmed && !needsNewVersion ? "primary" : "secondary"} size="md">
              Send for review
            </ActionButton>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-2xl">Intent</h2>
              {raw.intentConfirmed ? <Tag>Confirmed by creator</Tag> : raw.intent ? <Tag>Proposed: needs confirming</Tag> : null}
            </div>
            {editable ? (
              raw.intent ? (
                <div className="mt-3">
                  <InlineForm action={confirmIntentAction} hidden={hidden} ariaLabel="Confirm intent" submitLabel={raw.intentConfirmed ? "Update intent" : "Confirm intent"}>
                    <p className="text-[14px] text-text-muted">Proposed from your text. Edit anything that is wrong, then confirm.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Goal" name="goal" defaultValue={raw.intent.goal} required maxLength={200} />
                      <TextField label="Audience" name="audience" defaultValue={raw.intent.audience} required maxLength={200} />
                      <TextField label="Key message" name="keyMessage" defaultValue={raw.intent.keyMessage} required maxLength={300} />
                      <TextField label="Call to action" name="callToAction" defaultValue={raw.intent.callToAction} required maxLength={200} />
                    </div>
                  </InlineForm>
                </div>
              ) : (
                <p className="mt-2 text-[14px] text-text-muted">Run a check to get a proposed intent.</p>
              )
            ) : raw.intent ? (
              <IntentView intent={raw.intent} />
            ) : (
              <p className="mt-2 text-[15px]">{s.intentSummary ?? "No intent recorded."}</p>
            )}
          </Card>

          {latest ? <ContentCard version={latest.version} content={latest.content} /> : null}
          {latest && previous ? <DiffCard fromVersion={previous.version} toVersion={latest.version} before={previous.content} after={latest.content} /> : null}

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
                ) : fixable.length ? (
                  <div className="mt-2">
                    <InlineForm action={applyFixesAction} hidden={hidden} ariaLabel="Choose fixes to apply" submitLabel="Apply selected fixes">
                      <p className="text-[14px] text-text-muted">Accept the fixes you agree with. Only those are applied, as a new version; the rest stay as they are.</p>
                      {findingsList}
                    </InlineForm>
                  </div>
                ) : (
                  findingsList
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
                      {x.status === "done" ? "Done" : x.deadline && Date.parse(x.deadline) < now ? "Overdue" : `Due ${formatDateTime(x.deadline, tz)}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-text-muted">Nobody assigned yet. A reviewer is assigned when it is sent for review.</p>
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
              Checked by <span className="font-semibold">{current?.serviceUsed ?? "nothing yet"}</span>, a rule-based mock run by Clearance&apos;s own
              backend. No external AI provider received this content.
            </p>
            <p className="mt-2 break-all text-[13px] text-text-muted">Stored at {s.contentPath} (private storage path; file storage arrives with Supabase Storage).</p>
          </Card>
        </div>
      </div>
    </>
  );
}
