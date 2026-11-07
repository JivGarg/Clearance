# Clearance — Product Requirements Document (PRD)

**Tagline:** Nothing goes live without clearance.  
**Status:** Implementation specification for Claude / coding agents  
**Version:** 1.0 — 7 November 2026  
**Design authority:** `dashboard-reference.png` (the user-selected warm ivory / gold / purple six-screen reference).  
**Source of product requirements:** `Clearance_HIVEMIND.pdf` (five-page project proposal).  

> **Agent instruction:** Build a real, testable, responsive full-stack product—not a static dashboard screenshot. Treat the supplied dashboard image as the *visual* source of truth, and this document as the *functional* source of truth. The reference's numbers, people, product names, and charts are illustrative, not production data. Do not invent successful compliance checks or approvals. Keep an explicit distinction between implemented functionality and placeholders.

## 1. Product summary

Clearance is a multi-tenant, role-aware web platform between content creation and publication. A brand loads approved guidelines, facts, terminology, logos/assets, and confidential or embargoed information. Creators submit captions, images, documents, and videos for a channel/campaign. An AI-assisted pipeline extracts content, identifies issues with evidence from approved sources, classifies risk, proposes intent-preserving fixes, and orchestrates human review. Approved content receives a recorded clearance decision. The system maintains revision history, audit logs, notifications, and insights, and re-evaluates affected drafts when facts or embargoes change.

**Core value:** Catch brand, factual, disclosure, accessibility, cross-channel, and leak risks before publication; automate safe routine work without allowing an LLM to bypass authorisation.

### 1.1 Goals
- Make pre-publication checks fast, explainable, and repeatable.
- Allow creators to upload and revise multi-format content with clear feedback.
- Preserve author intent while suggesting targeted corrections.
- Automatically route high-risk decisions to authorised humans.
- Protect confidential knowledge from external users and external AI services when marked local-only.
- Give admins a searchable, versioned brand knowledge base and operational insights.

### 1.2 Non-goals for initial release
- Direct publishing to social networks (future integration).
- Post-publication social listening (future integration).
- Google Docs, Canva, Notion, Slack integrations (future).
- On-premise deployment and extensive multilingual support (future).
- Claiming legal compliance certification or guaranteeing detection of all leaks.

### 1.3 Users / roles
| Role | Primary capability | Restrictions |
|---|---|---|
| Organisation admin | Set up org, invite users, configure risk permissions, manage knowledge and embargoes, inspect audit logs | Actions audited; cannot override system security policy |
| Brand manager | Manage campaigns, submissions, assignments, review workflows and insights | Limited to own organisation; embargo access only if authorised |
| Authorised reviewer (including legal/compliance) | Inspect evidence, approve/reject/escalate high-risk items, request revisions | Must be explicitly authorised for sensitive/high-risk approvals |
| Internal creator | Submit, edit, compare fixes, accept/reject changes, resubmit | Cannot self-approve high-risk content |
| External creator / agency | Submit assigned campaign content, view safe feedback and own revisions | No access to confidential knowledge, embargo details, other creators' private submissions |

Users may have multiple role assignments; enforce permissions server-side, not by hiding buttons.

## 2. Design system — strict visual direction

**Primary reference:** `dashboard-reference.png`. This is the six-panel screenshot the user selected again after rejecting the dark green/blue alternatives.

### 2.1 Look and feel
- Warm ivory / champagne application shell; off-white content surfaces; light beige sidebar.
- Gold/yellow gradient hero banner with large elegant serif italic headline: “Nothing goes live without clearance.”
- Purple as the principal interactive/data accent, with restrained gold, blue, green, amber, and red for semantics.
- Clean black/dark-charcoal text; generous whitespace; rounded white cards; thin warm-grey borders; extremely soft shadows.
- Desktop SaaS layout with a fixed-width left sidebar, top search/navigation bar, and modular bento-style dashboard cards.
- Use serif headings and polished sans-serif controls/body; suggested accessible font pairing: **DM Sans** + **Instrument Serif** (or close web-safe alternatives).
- Avoid neon glow, dark-mode default, greenish tint, glass blur everywhere, excessive gradients, huge decorative imagery, and distracting animation.
- Gradients should be limited to the brand hero or selected small accents; prioritize readability and speed.

### 2.2 Starter tokens (approximate; tune to reference)
```css
:root {
  --canvas: #f3ede5;
  --sidebar: #eee3d6;
  --surface: #fffdfb;
  --surface-muted: #f8f6f3;
  --border: #e9e4df;
  --text: #211f20;
  --text-muted: #77716e;
  --purple: #8b5cf6;
  --purple-soft: #f1eaff;
  --gold: #f4ba58;
  --success: #348a57;
  --warning: #ad751a;
  --danger: #c84d52;
  --radius-card: 18px;
  --radius-control: 12px;
  --shadow-card: 0 6px 24px rgba(52, 37, 23, .045);
}
```
Use WCAG AA contrast for all small text and interactive states; do not use pastel badge backgrounds as the only indication of risk.

### 2.3 Layout and reusable components
- `AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `SearchCommand`, `UserMenu`, `NotificationBell`.
- `MetricCard`, `GradientHeroCard`, `ChartCard`, `RiskBadge`, `StatusBadge`, `DataTable`, `FilterBar`, `EmptyState`, `Skeleton`, `Modal`, `Toast`, `Tabs`, `Timeline`, `ActivityLog`, `FileDropzone`, `FilePreview`, `EvidenceCitation`, `DiffViewer`, `ApprovalActions`, `AccessDenied`.
- Sidebar groups: **Main** (Dashboard, Submissions, Reviews, Knowledge Base, Analytics), **Management** (Users & Roles, AI Agent Settings, Integrations [future/disabled]), **Account** (Settings, Audit Log, Notifications).
- Keep sidebar, spacing, icon style, headers, cards, and status language consistent across pages.
- Responsive: desktop >=1280px multi-column; tablet stacked cards + collapsible sidebar; mobile single column, usable forms/tables, no horizontal page overflow.
- Use Lucide icons, Tailwind CSS, shadcn/ui primitives, and Recharts (or equivalent) for maintainable implementation.
- Charts use real queried data, with honest zero/empty states. Do not hard-code 482 submissions or 98.1% compliance as real results.

### 2.4 Screen-specific reference mapping
The six frames in the reference image map to:
1. **Admin Overview** — warm gradient brand banner, content flow chart, KPI cards, recent submissions table, risk donut.
2. **Submit New Content** — large upload dropzone, supported content types, process steps, channel/campaign/type controls.
3. **Review Submission** — selected submission, AI findings, evidence, side-by-side original/suggested versions, approval controls.
4. **Content Insights** — compliance KPIs, submissions vs cleared chart, top issue categories.
5. **Brand Knowledge Base** — category tabs, searchable asset/guideline folders, recent updates.
6. **Users & Roles** — role totals, member table, invite and role actions.

Build the other required pages with the *same* visual grammar, not an unrelated theme.

## 3. Information architecture and routes

Use Next.js App Router with organisation-scoped routes. Suggested routes (adapt to implementation conventions):

| Route | Screen | Roles |
|---|---|---|
| `/login`, `/accept-invite` | Auth/invite acceptance | Public/invited |
| `/org/[orgId]/dashboard` | Overview | All (role-aware data) |
| `/org/[orgId]/submissions` | Searchable submission list | Permitted members |
| `/org/[orgId]/submissions/new` | New submission | Creators, managers |
| `/org/[orgId]/submissions/[id]` | Details, AI findings, revisions, intent, comparison | Authorised viewers |
| `/org/[orgId]/reviews` | Review queue, deadlines, filters | Managers/reviewers |
| `/org/[orgId]/reviews/[id]` | Approval/rejection/escalation | Assigned authorised reviewers |
| `/org/[orgId]/campaigns` | Campaigns, channel comparison | Managers/admins |
| `/org/[orgId]/knowledge` | Brand knowledge library | Authorised users; filtered |
| `/org/[orgId]/knowledge/[id]` | Source details and versions | Authorised users |
| `/org/[orgId]/embargoes` | Confidential items and release dates | Authorised admins/managers |
| `/org/[orgId]/analytics` | Insights and trends | Managers/admins |
| `/org/[orgId]/users` | Members, roles, invites | Admins |
| `/org/[orgId]/agent` | Agent actions, risk rules, automations | Admins |
| `/org/[orgId]/notifications` | In-app notifications | All |
| `/org/[orgId]/audit` | Tamper-evident audit timeline | Admins/auditors |
| `/org/[orgId]/settings` | Organisation settings | Admins |

Route guards must be backed by API and database authorisation.

## 4. Detailed feature requirements

### 4.1 Organisation setup and roles
- Admin creates organisation, sets name, default timezone, and invites internal/external members.
- Invite links expire; invited members accept and authenticate.
- Roles, memberships, campaign assignments, and reviewer eligibility are persisted.
- Admin can deactivate users and revoke access; preserve historical audit attribution.
- All reads/writes are tenant-scoped with Supabase RLS and backend permission checks.

**Acceptance:** An external creator cannot fetch another organisation's files, private submissions, or confidential guidelines even with a guessed URL or API ID.

### 4.2 Brand knowledge base
- Upload PDFs, text/docs, approved facts and figures, terminology, logos/assets, campaign rules.
- Store version, source title, author, effective dates, classification, approval status, timestamps, and provenance.
- Extract and chunk text; create embeddings; retrieve evidence from approved, currently effective versions only.
- Search/filter by type, date, owner, campaign, status; display source citations for findings.
- Support explicit `public_to_creators`, `internal`, `confidential`, `local_only` visibility classifications.
- Changes to an approved fact enqueue impact analysis for affected *pending* submissions and alert owners; never silently mutate approved/published records.
- If evidence is insufficient, mark `needs_clarification`; ask an authorised admin a precise question and store the response as a **draft fact requiring approval** before using it as authoritative.

**Acceptance:** Every factual finding links to an accessible source version; restricted source text never appears in external creator feedback.

### 4.3 Submission and intent confirmation
- Upload text/caption, image, document, or video; choose channel, campaign (optional), content type, intended publish date (optional).
- Validate file types/sizes and enforce server-side limits; use signed uploads to private storage.
- Store original media immutably and create revision records for edits.
- Extract a short proposed intent: goal, audience, key message, call to action. Creator must confirm/edit before final check.
- Submission statuses: `draft`, `uploaded`, `processing`, `needs_intent`, `checking`, `changes_proposed`, `needs_creator_revision`, `in_review`, `on_hold`, `cleared`, `rejected`, `failed`, `cancelled`.
- Show processing progress, errors, retries, and the last completed stage; do not show a false success state.

**Acceptance:** A creator can submit a text draft, confirm intent, view findings, and submit a revised draft end-to-end.

### 4.4 Multimodal ingestion
- Text: normalize while preserving original content and positions.
- Images: OCR for on-image text, vision-based descriptions and logo/asset matching; show image region if available.
- Documents: extract text and page numbers; preserve document preview and source locations.
- Videos: FFmpeg extract audio and sampled frames; Whisper transcribe audio with timestamps; OCR and logo matching on frames; aggregate issues with timestamps.
- Processing occurs asynchronously in workers with durable job state and bounded retries; large files must not block HTTP requests.
- Local-only/confidential content must never be sent to an external LLM/vision API. For initial prototype, use local-safe checks or mark unsupported analysis as blocked, never silently send data.

**Acceptance:** A short video can be submitted and produces time-stamped transcript/frame findings; failures are surfaced with retry options.

### 4.5 Compliance analysis with evidence
Check against approved knowledge and configurable rules:
- Incorrect or outdated facts, prices, dates, product claims.
- Wrong terminology, brand voice, unapproved logos/assets.
- Sponsored/ad disclosure checks where relevant (configurable by market/channel; not a legal guarantee).
- Accessibility checks (e.g. missing alt-text/captions when applicable).
- Embargoed product names, codenames, launch dates, unreleased facts.
- Cross-channel contradictory claims within a campaign.

For every finding persist: `type`, `severity`, `confidence`, `explanation`, `source_document_id`, `source_version`, `source_span`, `content_span_or_timestamp`, `recommended_action`, `visibility`, `status`.

**Guardrails:** Do not present an unsupported assertion as fact. If no approved source exists, mark uncertain and request clarification. Do not expose embargo text to unauthorised creators; show a safe generic hold reason.

### 4.6 Risk engine and autonomous agent
- **Low risk:** agent may apply approved deterministic/low-impact fixes and log changes, subject to org settings.
- **Medium risk:** agent prepares proposed fix; a permitted human must approve before it becomes effective.
- **High risk:** publishing hold and authorised reviewer approval required; never auto-clear.
- Risk is determined by a server-side policy/rules engine; LLM may propose severity but cannot lower a policy-mandated risk or grant permissions.
- Agent capabilities: run checks, draft corrections, create review assignments, send reminders, escalate overdue tasks, schedule re-checks, draft knowledge questions, and suggest KB updates.
- Each action has actor, tool, inputs summary, timestamp, decision rationale, outcome, and reversal metadata where feasible.
- Undo means reversible application actions (e.g. revert a suggested text revision), **not** erasure of immutable audit history.
- Prevent infinite loops: max revision/check attempts, idempotency keys, retry limits, and stop conditions.

**Acceptance:** A high-risk embargo finding cannot transition to `cleared` through the agent or a creator-only API call.

### 4.7 Intent-preserving fixes and comparison
- Show original vs suggested text or visual asset with highlighted differences.
- Proposed changes reference specific findings and approved source citations.
- Check suggestions against confirmed goal/audience/message/CTA; flag meaning changes for manual review.
- Allow accept/reject **each** change, apply selected changes to a new revision, and rerun checks.
- For image/video edits beyond MVP, provide timestamped or region-specific revision instructions rather than pretending the system can edit media flawlessly.

**Acceptance:** Accepting one proposed change leaves other changes untouched and preserves a revision diff.

### 4.8 Reviews, notifications, and clearance
- Auto-assign reviewers by issue category, risk, eligibility, and workload; allow authorised manual reassignment.
- Reviewer queue supports risk, campaign, channel, assignee, due date, status, and overdue filters.
- Reviewer can approve, reject with reason, request revision, or escalate; high-risk actions require correct permission.
- In-app notifications for assignment, revision requested, clearance, embargo release, and overdue reviews; email is a later extension.
- Clearance record includes approved revision hash, approver(s), policy version, source versions, timestamps, and decision history.
- **Important:** In the MVP, `cleared` means *approved for publishing*, not that the system has posted to a social network. Direct publishing is future scope.
- Re-uploaded drafts trigger a new check; stale approvals must not carry over to changed content.

**Acceptance:** Approval of revision A does not approve modified revision B; a new check/review is required.

### 4.9 Embargo and confidentiality
- Admin stores embargo subject/aliases, classification, release timestamp, and authorised visibility.
- Compare drafts to embargo terms and semantic matches in text, speech, and image OCR.
- Block clearance while active; at expiry, **requeue review** (do not auto-publish or auto-approve).
- Display a disclosure panel indicating which processing services handled each content item and whether any external provider was used.
- Confidential content uses private storage, signed URLs, least-privilege access, and redacted creator-facing findings.

**Acceptance:** An external creator sees “Restricted information requires internal review” rather than the confidential codename or source text.

### 4.10 Cross-channel contradiction checks
- Group submissions by campaign and effective time period.
- Extract structured claims (product, offer, price, dates, conditions) and compare across channels.
- Show linked conflicting submissions side by side with approved fact evidence.
- If authoritative facts are missing, request clarification; do not arbitrarily choose a winner.

### 4.11 Analytics and insights
- KPI cards: submissions, cleared, in review, high-risk holds, median/average review time, auto-fix count.
- Charts: submissions vs cleared by date, risk distribution, top issue categories, approval turnaround, recurring guideline ambiguity.
- Filters by date, channel, campaign, reviewer and content type; export CSV where authorised.
- Define metrics transparently: e.g. `clearance_rate = cleared submissions / eligible processed submissions`; show N/A on zero denominator.
- Never fabricate trends or performance deltas; seed demo records only in clearly marked demo mode.

## 5. Technical architecture

### 5.1 Required stack (from proposal)
- **Frontend:** Next.js (React + TypeScript), Tailwind CSS; deploy on Vercel.
- **Backend:** Python FastAPI; deploy on Railway or Render.
- **Database/auth/storage:** Supabase PostgreSQL, Supabase Auth, private Supabase Storage, row-level security.
- **Async jobs:** durable queue and separate worker for analysis and video processing. Choose Redis + RQ/Celery or a Postgres-backed queue; document choice.
- **AI:** configurable LLM provider abstraction; embeddings and retrieval for guideline matching. Model/provider credentials only server-side.
- **Media:** FFmpeg, Whisper or compatible speech-to-text, OCR, vision/logo matching.
- **Developer tools:** Figma, VS Code, Git/GitHub, Postman.

### 5.2 Suggested monorepo
```text
clearance/
  PRD.md
  dashboard-reference.png
  apps/
    web/                  # Next.js, TypeScript, Tailwind, UI
    api/                  # FastAPI endpoints and services
    worker/               # Async ingestion and AI jobs
  packages/
    ui/                   # Optional shared frontend components
    contracts/            # OpenAPI-generated TS types / shared schemas
  supabase/
    migrations/           # SQL schema, indexes, RLS, policies
    seed.sql              # Explicitly labelled demo data
  tests/
    e2e/                  # Playwright flows
    security/             # Tenant isolation, permissions, embargo
  docs/
    architecture.md
    ai-policy.md
    deployment.md
  .env.example
  README.md
```

### 5.3 Logical processing pipeline
```text
Creator uploads -> private storage -> submission record
  -> async extraction (text / OCR / video transcript / frames)
  -> intent extraction -> creator confirmation
  -> approved-knowledge retrieval + rule checks
  -> evidence-grounded findings -> server-side risk classification
  -> low-risk suggestion/auto-fix OR medium approval OR high-risk hold
  -> creator diff/revision -> recheck -> reviewer approval
  -> immutable clearance decision + notifications + audit
```

### 5.4 Minimum database entities
Every tenant-owned entity has `org_id`; use UUID primary keys, timestamps, indexes, and RLS.

| Table | Key fields / relationships |
|---|---|
| `organizations` | name, timezone, settings |
| `memberships` | org_id, user_id, roles, status |
| `invitations` | email, role, token_hash, expires_at, status |
| `campaigns` | name, date range, channels, owner |
| `knowledge_documents` | title, type, classification, approved_version_id |
| `knowledge_versions` | document_id, version, text/asset path, status, effective_at, source metadata |
| `knowledge_chunks` | version_id, text, embedding, page/span, access class |
| `approved_facts` | key, value, units, valid_from/to, approved_by, version |
| `embargoes` | subject/aliases, confidential reference, release_at, state |
| `submissions` | creator_id, campaign_id, channel, content_type, status, current_revision_id |
| `submission_revisions` | submission_id, original_file_path, extracted_text, content_hash, intent, revision_no |
| `processing_jobs` | revision_id, stage, status, attempts, error_code, timestamps |
| `findings` | revision_id, type, severity, evidence, location, visibility, state |
| `proposed_fixes` | finding_id, patch, reason, approval_state, accepted_by |
| `review_assignments` | revision_id, reviewer_id, due_at, status, escalated_at |
| `review_decisions` | revision_id, reviewer_id, decision, reason, timestamp |
| `clearance_records` | revision_id, hash, policy_version, approvers, source snapshot |
| `notifications` | recipient_id, event_type, payload, read_at |
| `agent_actions` | action_type, policy_decision, inputs_digest, result, reversible_ref |
| `audit_events` | actor, org_id, event, target, timestamp, before/after digest |

Use vector indexing where supported; choose and document embedding model/dimension. Do not expose `service_role` credentials in browser code. Apply RLS and backend authorization on all read/write paths; test signed media URLs.

### 5.5 API contract (illustrative REST endpoints)
- `POST /v1/orgs`, `GET /v1/orgs/{id}`, `POST /v1/orgs/{id}/invites`, `GET /v1/orgs/{id}/members`
- `GET/POST /v1/orgs/{id}/knowledge`, `POST /v1/orgs/{id}/knowledge/{docId}/versions`, `POST /.../approve`
- `GET/POST /v1/orgs/{id}/embargoes`, `PATCH /.../embargoes/{embargoId}`
- `POST /v1/orgs/{id}/submissions`, `GET /v1/orgs/{id}/submissions`, `GET /.../submissions/{submissionId}`
- `POST /.../submissions/{submissionId}/upload-url`, `POST /.../submissions/{submissionId}/revisions`
- `POST /.../revisions/{revisionId}/confirm-intent`, `POST /.../revisions/{revisionId}/check`
- `GET /.../revisions/{revisionId}/findings`, `POST /.../fixes/{fixId}/accept`, `POST /.../fixes/{fixId}/reject`
- `GET /v1/orgs/{id}/reviews`, `POST /.../reviews/{assignmentId}/decision`
- `GET /v1/orgs/{id}/analytics`, `GET /.../notifications`, `GET /.../audit`
- `GET/PATCH /v1/orgs/{id}/agent-policy`, `GET /.../agent-actions`

Define Pydantic request/response schemas and generate an OpenAPI contract for typed frontend clients. Return consistent error payloads, pagination, filter params, idempotency for mutations, and structured async job status.

## 6. Security and safety requirements (release blockers)
- Verify Supabase JWTs server-side and enforce membership/role checks on each endpoint.
- RLS for every tenant-owned table; test cross-tenant reads/writes and guessed IDs.
- Private media buckets, expiring signed URLs, content-type validation, upload size limits, malware scanning where feasible.
- Encrypt sensitive data in transit and at rest; redact secrets and confidential content from logs.
- Do not send local-only material to external model services, including embeddings, vision, and logging/telemetry providers.
- Prevent prompt injection from uploaded documents: treat all submitted content and KB text as data, not tool instructions.
- AI suggestions are not authority; policy engine and authorised humans control high-risk decisions.
- Version approvals and source facts; audit every override, access to confidential items, reviewer decision, and agent action.
- Define retention/deletion policy, user access revocation, backup/recovery, and environment secret management.
- Do not label a piece of content “legally compliant” solely because an LLM passed it.

## 7. UX states and accessibility
Every page must handle: loading, empty, success, error, permission denied, expired session, offline/retry, and partial processing. Forms require validation and helpful messages. Tables support sorting/filtering/pagination. Keyboard navigation, visible focus rings, accessible labels, semantic headings, and reduced-motion support are mandatory. Provide light/dark contrast testing, but **light warm theme is the default and only required theme for MVP**.

## 8. Implementation plan — build in vertical slices

### Phase 0 — Foundation / visual fidelity
- Initialise monorepo, lint/format/typecheck, env templates, CI, local Supabase setup.
- Copy the reference image into project root as `dashboard-reference.png`.
- Implement design tokens, AppShell, sidebar, topbar, shared cards/tables/badges, responsive layout.
- Build all six referenced pages with clearly labelled demo data to validate visual consistency; do not mistake mock screens for functional completion.

### Phase 1 — Round 2 working prototype (highest priority)
- Auth, org memberships, role-aware navigation, RLS.
- Brand knowledge upload and approved fact CRUD.
- Creator text/image submission, intent confirmation, async checks with citations.
- Risk classification, findings, suggested corrections, reviewer queue, decision flow.
- Real dashboard metrics from DB; revision and audit history.
- E2E demonstration: upload -> check -> fix -> review -> cleared.

### Phase 2 — Round 3 full demo
- Short-video ingestion: FFmpeg, Whisper, OCR/frame matching.
- Embargo detection and hold/release-to-review.
- Cross-channel contradiction detection and campaign view.
- Agent routing/reminders/escalation with configurable limits, logs, undo where feasible.
- Insights dashboard, notification centre, improved comparison UI.
- Security/permissions hardening, realistic test content, demo rehearsal.

### Phase 3 — Future integrations (not MVP)
- Direct social publishing, external editor integrations, post-publication monitoring, guideline assistant, on-premise and more languages/formats.

## 9. Definition of done / acceptance test matrix

| ID | Scenario | Expected result |
|---|---|---|
| A01 | Admin invites reviewer | Reviewer can join org and sees only authorised routes |
| A02 | External creator tries to read embargo | API denies; no secret in client payload |
| A03 | Creator submits text with incorrect approved price | Finding cites correct approved fact and highlights mismatch |
| A04 | Creator confirms intent and accepts one suggested fix | New revision contains only selected fix; history preserved |
| A05 | Creator uploads image with on-image offer | OCR-derived issue is tied to image and source |
| A06 | Creator uploads short video with spoken claim | Transcript/timestamp issue appears, or explicit processing error |
| A07 | High-risk unreleased launch mention | Submission held; no auto-clear; confidential details redacted |
| A08 | Embargo date passes | Draft is requeued for review, not auto-published |
| A09 | Two campaign posts disagree on price | Cross-channel issue links both posts and approved fact or clarification |
| A10 | Reviewer approves a revision | Clearance record captures revision hash, reviewer, policy/source versions |
| A11 | Creator edits approved content | Old clearance does not apply to new revision |
| A12 | Org A user guesses Org B submission ID | 403/404, no data leak |
| A13 | AI provider fails | Job is retryable/failed; no fabricated result or success banner |
| A14 | Dashboard has no records | Honest zero/empty states, no fake charts |
| A15 | Keyboard-only user navigates review | All controls operable and labelled |
| A16 | Restricted content marked local-only | No outbound LLM, OCR, embeddings, or telemetry request with content |

**Release gates:** Tests passing (unit, integration, E2E, RLS/security); working env setup; no hard-coded secrets; no critical accessibility issues; no fake production analytics; no unauthorised approval path.

## 10. Demo seed data and example walkthrough
Use a clearly labelled fictional brand (e.g. **Sonic X Audio**) with:
- Approved product claim: “50 hours battery life”; an uploaded reel incorrectly claims “60 hours”.
- Required sponsored-content disclosure for an example paid campaign; draft omits it.
- Brand terminology rule preferring “Sonic X1” to a variant spelling.
- An unreleased product codename with a future embargo date.
- Two campaign posts advertising conflicting discount values.

Seed submissions at different states to populate dashboards. Keep all metrics derived from these rows; mark the environment `DEMO` in the UI. Never use real personal data as seed content.

## 11. Coding-agent operating instructions (Claude)
1. **Read this entire PRD and inspect `dashboard-reference.png` before changing UI.** Do not adopt the later dark neon/blue designs.
2. Inspect existing repository first; preserve working code and conventions. If repository is empty, scaffold the stack above.
3. Create `IMPLEMENTATION_PLAN.md` with milestones and checklist; then implement the smallest fully functional vertical slice before expanding breadth.
4. Keep all integration secrets in environment variables; ship `.env.example`, not `.env`.
5. Make reusable components and typed API contracts; avoid copy-pasting nine dashboards or building monolithic pages.
6. Use actual database-backed data. Only use mock data in a clearly labelled demo environment; never disguise fake AI checks as real.
7. Separate extraction, retrieval, analysis, policy, agent action, review, and clearance into testable modules.
8. Enforce permissions in database/backend; never rely on UI-only checks.
9. Write tests alongside implementation, especially for embargo privacy, multi-tenancy, approval boundaries, and stale revisions.
10. Run typecheck, lint, unit tests, and E2E checks after each major slice; fix failures before proceeding.
11. Document trade-offs and unimplemented functionality in `README.md` and `KNOWN_LIMITATIONS.md`.
12. At completion, report exact implemented routes, working flows, setup commands, test results, and remaining gaps; do not claim unsupported features are complete.

## 12. Team ownership (from original proposal)
| Member | Area |
|---|---|
| Jivesh Garg | AI pipeline, agent, content checks, multimodal processing, backend AI APIs |
| Jaskirat Singh Khanna | Supabase schema, auth, RLS, submissions/reviews, job queue, notifications |
| Gauransh Bhaba | UI/UX, frontend dashboards, submission flow, diff/review screens, insights |
| Kanishq Tewatia | Figma design, visual identity, documentation, presentation/demo |

## 13. Open decisions for the team (do not silently assume)
- Exact LLM/embedding/vision providers, budget, data residency, and confidential local-only processing implementation.
- Supported video length/file limits and document formats for demo vs production.
- Specific ad disclosure/accessibility rules by country and channel, and who approves those rules.
- Reviewer assignment priority, escalation deadlines, and timezones.
- Whether brand managers may approve medium-risk changes in every organisation.
- Whether external creators can view selected public guidelines directly.
- Deployment quotas, expected throughput, observability and retention windows.

**Default when unresolved:** Choose the safest reversible MVP behavior, make it configurable, document it, and never weaken tenant isolation or high-risk approval controls.

---

**Final product principle:** Clearance is a brand-aware pre-publication verification and approval system with evidence-grounded AI assistance, not an autonomous publisher or a substitute for authorised human judgement.
