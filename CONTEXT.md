# CONTEXT.md: Clearance working notes

Read this first in every session. It is the engineering state: what exists, how to run it, what
was decided, what is verified, what is next. **Update it at the end of every session.**

## 0. Which spec governs (decided 2026-11-07)

| Concern | Source of truth |
|---|---|
| Visual design, screens, routes, product behaviour | **[designPRD.md](designPRD.md)**, with a **glassmorphism** treatment of its warm ivory / gold / purple palette (team decision) |
| Database: tables, roles, access matrix, integrity rules | **[DataBasePRD.md](DataBasePRD.md)** |
| Workflow background only | [PRD.md](PRD.md) (original brief; its neo-brutalist design, 5 roles and 10 statuses are **superseded**) |

Team decisions on top of those documents:
- **Internal and external creators are one role, `creator`, with identical access** (decided
  2026-11-08). There is no `access_scope` column: DataBasePRD's `access_scope` is intentionally not
  implemented. Every creator reads public + internal knowledge, never confidential or local-only.
- Supabase keys are not set yet; the schema is written and tested locally (section 8).
- `dashboard-reference.png` and `Clearance_HIVEMIND.pdf`, which designPRD cites, are **not in the
  repo**; the visuals follow designPRD's written description and tokens.

**Status (2026-11-10):** every screen in designPRD 3 is built on the in-memory **demo store**
(section 3.8). Admin (2026-11-08) plus the **full workflow** (2026-11-10): creator new submission ->
check via the backend mock -> confirm intent -> accept fixes one by one -> send for review ->
auto-assigned reviewer decides (approve / request changes / reject) -> creator revises -> manager
assigns/reassigns and releases. Nothing talks to Supabase yet; the AI pipeline is still the
rule-based mock (section 3.6).

---

## 1. Run it

```bash
# Frontend (Next.js 16.4, Cache Components, Tailwind v4)        http://localhost:3000
# Checks call the backend: run it too, or set API_URL. Without it, drafts save with "not reachable".
cd frontend && npm install && npm run dev
npm run build | npm run lint | npx next typegen && npx tsc --noEmit

# Backend (FastAPI, Python 3.11)                                http://localhost:8000/docs
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest                                    # 37 tests

# Database: real migrations + seed + tests on a throwaway local Postgres (no Supabase needed)
pip install pgserver psycopg2-binary && python supabase/tests/run_local.py     # 70 expectations
```

- **Demo sign-in** (password `clearance-demo`): `admin@`, `manager@`, `reviewer@`, `creator@`,
  `agency@sonicx.test`, and `admin@northwind.test`. The agency user belongs to **both** companies
  (a creator in each) to exercise multi-company access.
- **Env:** one `.env` at the repo root (template `.env.example`), loaded by `frontend/next.config.ts`
  and `backend/app/config.py`. Git-ignored. Server-only keys never get a `NEXT_PUBLIC_` prefix.
  `.env` currently holds only `GEMINI_API_KEY` (its value was once printed in a session transcript:
  **rotate it**).
- Production builds refuse demo sign-in unless `ALLOW_DEMO_AUTH=true`.
- **Applying SQL to Supabase:** `supabase db reset` (CLI), or paste the three migrations in order and
  then `seed.sql` into the SQL editor. `seed.sql` refuses to run on a non-empty database. **Never edit a
  migration already applied to a shared database; add a new one.**

## 2. Repo map

| Path | What |
|---|---|
| `frontend/src/app/org/[orgId]/` | Company-scoped app (designPRD 3): `dashboard submissions[/new,/[id]] reviews[/[id]] campaigns knowledge[/[id]] embargoes analytics users agent notifications audit settings` |
| `frontend/src/app/login`, `design-system` | Sign-in; reference page rendering every token and component (signed-in only) |
| `frontend/src/components/ui/` | button, card (+ MetricCard, GradientHeroCard), badge (status, risk, tag), source-chip, field, tabs, toggle, autonomy-control, table, empty-state, dialog (Modal, Drawer), toast |
| `frontend/src/components/layout/` | app-shell, nav-links (grouped), mobile-nav, org-switcher, role-switcher (demo accounts), notifications-panel (live bell), user-menu, page-header, placeholder-page, demo-notice |
| `frontend/src/components/forms/` | `form-dialog` (modal form + server action), `action-button` (one-click action, optional confirm), `inline-form` (settings forms) |
| `frontend/src/components/charts/`, `submissions/` | Dependency-free BarList / GroupedColumns / ChartCard; shared SubmissionsTable |
| `frontend/src/lib/data/` | **Demo store** (section 3.8): `types.ts` (rows = DB tables), `seed.ts` (= seed.sql), `store.ts`, `queries.ts` (reads, filtered like RLS), `mutations.ts` (admin writes), `workflow.ts` (create/check/revise/apply fixes/send/assign/decide, enforcing the trigger rules) |
| `frontend/src/lib/check-service.ts`, `diff.ts` | Server-side client for the backend check service (`API_URL`); word diff for version comparison |
| `frontend/src/components/submissions/` | SubmissionsTable; ContentCard, DiffCard, IntentView |
| `frontend/src/lib/` | `domain.ts` (enums/types), `roles.ts` (nav groups, `PAGE_ROLES`, `orgPath`, `homeFor`), `demo-users.ts`, `session.ts` (**auth seam**, `requireOrg` returns an `actor`; `actorFor` for actions), `format.ts` (timezone dates), `actions/auth.ts`, `actions/admin.ts`, `actions/workflow.ts` |
| `backend/app/` | `schemas.py`, `routing.py` (risk routing, pure), `mock_checks.py` (Sonic X rule bank), `routers/` |
| `supabase/migrations/` | `20261107000001_schema` (16 tables), `..02_rules` (integrity triggers), `..03_rls` (access matrix) |
| `supabase/seed.sql` | Two fictional companies, 7 users, 8 submissions driven through the real workflow |
| `supabase/tests/` | `rls_test.sql`, `00_local_stub.sql`, `run_local.py` |

## 3. Architecture and decisions

**3.1 Auth is a seam (demo cookie).** `lib/session.ts` reads an httpOnly cookie with a seeded user id.
It is forgeable and exists only so screens can be built before Supabase Auth. To go real, replace
`getSessionUser()` with Supabase (`auth.getUser()` then `users` + `org_memberships`); callers
(`requireUser`, `requireOrg`) stay. Ids in `demo-users.ts` equal `seed.sql`.

**3.2 Roles are per company.** A user's role comes from `(user, orgId)`; the URL carries the company.
`requireOrg(orgId, roles)` sends non-members to their own home (never confirming the company exists)
and wrong roles to that company's dashboard. Page access lives in `PAGE_ROLES` (roles.ts).

**3.3 Next.js 16 Cache Components rules** (read `frontend/node_modules/next/dist/docs/` first):
- Session reads sit inside `<Suspense>` (the org layout does this in a child component).
- **In `getSessionUser()` the cookie read comes first, unconditionally.** An early return before
  `cookies()` once froze a `307 /login` into the build for every visitor.
- **Static page content reaches people who fail the guard** (it rides in the RSC payload). Never put
  protected data in static or cached content; fetch it per request after the check.
- Hidden previous routes stay mounted (`<Activity>`), so the DOM can hold two copies of shell
  controls. Tests must target `:visible` elements.
- Use `proxy.ts`, not `middleware.ts`, if one is ever needed.

**3.4 Route guards are UX; the database is the security** (DataBasePRD rule 1, designPRD 6).

**3.5 Database design** (beyond DataBasePRD, documented in the migrations):
- **Additions:** `ai_checks.revision_id` and `approval_decisions.revision_id` (a decision applies to one
  exact revision, designPRD 4.8); `visibility_class` enum from designPRD 4.2 (`public_to_creators`,
  `internal`, `confidential`, `local_only`) used by assets, facts and embargoes; a composite FK makes
  a submission's campaign belong to the same company; views `current_facts` and `active_embargoes`
  (rule 7).
- **Status flow** (enforced by trigger): `draft -> in_review` (creator, needs a revision);
  `in_review -> approved | rejected | changes_requested` **only via an `approval_decisions` row**;
  `changes_requested -> in_review` (creator, after a new revision); `approved -> released`
  (admin/manager); a new revision on approved content sends it back to `in_review` (stale approval).
  `rejected` and `released` are final.
- **Decisions:** reviewer only, active reviewer membership, open assignment, not the creator, latest
  revision, non-approve decisions need comments, no approval or release while an unreleased embargo is
  cited (two independent layers).
- Append-only: `approval_decisions`, `revisions`, `agent_action_log` (even for the service role). No
  deletes on submissions or their children. A company with submissions cannot be deleted.
- Creators never see findings whose source they may not read; `restricted_issue_count(submission)`
  lets the UI show "Restricted information requires internal review" (designPRD 4.9).
- "System" = service role, or no signed-in user; the definer trigger functions also act as system.

**3.6 Backend is a labelled mock.** `POST /api/checks/run` returns deterministic rule-based findings
(`mock: true`, `service_used: "mock-rules-v1"`, matching `ai_checks.service_used`). Risks are
low/medium/high; an embargo is high with `route.hold = true` and never echoes the codename. High is
never auto-applied. It is unauthenticated and writes nothing yet.

**3.7 Domain constants live in three places** (`frontend/src/lib/domain.ts`, `backend/app/schemas.py`,
SQL enums). Change them together.

**3.8 Demo store (until Supabase is connected; decided 2026-11-08).** `lib/data/` holds an
in-memory copy of the database on `globalThis`, seeded from `seed.ts` (same ids/rows as `seed.sql`,
timestamps spread over two weeks). It resets when the server restarts and is labelled "Demo data" on
every screen. `queries.ts` filters exactly like the RLS policies (`canSeeClass`, `canViewSubmission`,
`canSeeSource`, `hasActiveEmbargo` mirror the SQL helpers); `mutations.ts` enforces the same rules as
the triggers and throws `RuleError` with a user-safe message. Server actions (`actions/admin.ts`)
re-check session + role via `actorFor`, then call a mutation. **Swapping to Supabase = reimplement
queries.ts/mutations.ts against Supabase; screens and actions stay.** The session now reads users
and memberships from the store, so role changes and suspensions apply on the next request. An
invited person signing in with the demo password accepts the invitation (stand-in for invite links).

Admin rules added in the app layer (beyond the DB): you cannot change or suspend yourself; a company
keeps at least one active admin; editing a guideline's rule bumps its version; editing or expiring a
fact notifies owners of pending submissions that cite it (designPRD 4.2); a new fact cannot be
already expired, a new embargo must be in the future; lifting an embargo never approves anything
(held work stays in review, designPRD 4.9); medium risk can never be set to auto-fix and high risk is
not configurable (designPRD 4.6); dates are entered and shown in the company timezone.

**Workflow (2026-11-10), `lib/data/workflow.ts`.** The frontend calls the backend from the server
(`API_URL`, falling back to `NEXT_PUBLIC_API_URL`, then `http://localhost:8000`); a down service
gives an honest retryable error and keeps the draft (A13). The backend now returns each finding's
`rule` key; `RULE_SOURCES` links it to that company's own guideline / current fact / asset / active
embargo. **A finding with no approved source in the company is not recorded** (designPRD 4.5) and
the creator is told how many were skipped. Auto-fix: low/medium fixes the admin set to auto-fix
become an agent-authored version (logged with undo data), then that version is re-checked; checks per
version are capped by `maxCheckAttempts`. Accepted fixes apply only the chosen spans (A04); the
ad-disclosure fix prepends `#ad`. Sending needs a confirmed intent and a check on the current version;
resubmitting after "changes requested" needs a newer version. Auto-assign picks the previous
reviewer, else the least-loaded eligible reviewer (never the creator), deadline from agent settings;
none eligible -> managers notified. Editing approved content sends it back to review and re-assigns
(A11). Decisions mirror the decision triggers (assigned, not own work, comments unless approving,
no approval with an active embargo). Creators see their own text even if it names an embargoed item;
they never see the embargo record or its finding.

**Needs schema decisions (demo store only, no table yet):** agent settings, company timezone, and an
admin audit trail (`adminEvents`: membership/knowledge/settings changes; designPRD 6 requires them
audited). Shown in the UI as "Not in database yet". Also demo-only fields: version text
(`revisions.content`; Supabase keeps it in storage), finding spans + rule (`issues.spanStart/spanEnd/rule`,
designPRD 4.5 `content_span`), and the structured confirmed intent (`submissions.intent`,
`intentConfirmed`). Propose a migration before wiring Supabase.

## 4. Access matrix as built (DataBasePRD 4)

| Data | Admin | Manager | Creator | Reviewer |
|---|---|---|---|---|
| Organization / memberships | Edit | View | Own membership only | Own membership only |
| Guidelines | Edit | View | View | View |
| Assets, facts | Edit | View | View public + internal (never confidential / local-only) | View |
| Embargoes | Edit | Edit | View by class (seeded embargoes are internal/confidential) | View |
| Campaigns | Edit | Edit | View | View |
| Submissions, revisions, checks, findings | View | View | Own (create + revise) | Assigned |
| Review assignments | View | Edit | None | Own |
| Approval decisions | View | View | On own | Create on assigned |
| Agent action log | View | View | None | None |
| Notifications | Own | Own | Own | Own |

Choices where DataBasePRD left room: everyone reads their own membership/user row; staff read the
names of company members, creators only staff; guidelines (no visibility column) are readable by all
members; only creators create submissions (designPRD also lists managers: **open question**).

## 5. Design system

Tokens are defined once in `frontend/src/app/globals.css`. Use utilities (`bg-accent`, `text-text-muted`,
`rounded-card`, `.glass`), never raw hex. Glass = translucent warm white + backdrop blur over a fixed
gold/purple light; falls back to opaque surfaces without `backdrop-filter` or with
`prefers-reduced-transparency`.

**Contrast, measured.** designPRD's tokens were tuned to pass AA:
- `#8b5cf6` purple is decoration only (white text on it 4.23:1); interactive accent is `#7c3aed` (5.70:1).
- Muted text `#77716e` -> `#6b6461` (4.13 -> 4.99:1 on canvas).
- Semantic text: success `#2b7249`, warning `#8a5d12`, danger `#b23c42` (all at least 4.9:1 on canvas).
  The soft fills carry no meaning alone; badges always add an icon and a label.
- Gold only as a fill under dark text (9.37:1).
- Focus ring: 2px accent, 4.9:1 on canvas.

Note: designPRD says to avoid "glass blur everywhere". Glass is used for surfaces (cards, bars,
dialogs); the gradient is reserved for the hero banner. designPRD suggests shadcn/ui; components
here are hand-built to the same tokens instead (no dependency added).

## 6. Status against designPRD

| Screen | State |
|---|---|
| Login, shell, grouped sidebar, company switcher, demo-account switcher, user menu, mobile drawer | Done |
| Dashboard | Done (role-aware KPIs, recent submissions, risk mix, content flow, admin "needs attention") |
| Submissions list / detail | Done for viewing (search, filters, sort, pages; findings with citations, restricted message, decisions, versions, agent log, processing disclosure; staff "Mark as released") |
| Campaigns, Knowledge Base (+ source detail), Embargoes | Done (add/edit, expire fact, lift embargo, search, "cited by") |
| Analytics | Done (defined KPIs, weekly submitted vs cleared, risk, issue types, statuses, most-cited guidelines; channel/campaign filters; CSV export for admin/manager) |
| Users & Roles, AI Agent Settings, Settings, Audit Log, Notifications | Done (invite, change role, suspend/restore/revoke; autonomy per risk; company name + timezone; filtered timeline; mark read) |
| New submission, Submission detail (creator), Reviews, Review detail | Done (text only; intent confirm; per-fix accept with original vs suggested; version diff; send for review; queue with risk/channel/campaign/overdue filters; decisions; manager assign/reassign) |
| Not built | Image/document/video upload and processing; escalation of overdue reviews; embargo-expiry requeue job; cross-channel contradiction checks; reviewer "escalate" action |
| Integrations | Shown as "Soon" (designPRD: future) |

designPRD acceptance (section 9): A02 (creator cannot read a confidential embargo; since the creator
merge this applies to every creator, and *internal* embargoes are readable by all creators) and A12
(cross-company ID guess) are **enforced and tested in the database**; A07/A08 holds and A11 stale approval are enforced
in the database; everything else needs the UI wired to data.

## 7. Next steps, in order

1. AI pipeline (owner: Jivesh): replace mock rules with retrieval over the company's knowledge plus a
   model behind the same `CheckResponse` contract; keep confidential/local-only content off external
   providers; check fixes against the confirmed intent (the mock's tone fix "a great choice" shows why).
2. Decide and migrate the demo-store-only tables (agent settings, timezone, admin audit events).
3. Add Supabase keys to `.env`, create the project, run migrations + seed, **confirm the demo users can
   sign in** (GoTrue acceptance of seeded auth rows is untested).
4. Wire Supabase Auth into the session seam; reimplement `lib/data/queries.ts` + `mutations.ts` on
   Supabase (RLS does the filtering); keep demo auth behind `ALLOW_DEMO_AUTH`.
5. Storage buckets and policies (private, signed URLs); asset upload; New submission with upload.
6. Backend: verify JWTs, write `ai_checks` / `issues` / `agent_action_log` with the service role.
7. Embargo expiry job (requeue review, designPRD A08); overdue/escalation using the agent settings.
8. Write `IMPLEMENTATION_PLAN.md` and `KNOWN_LIMITATIONS.md` (designPRD 11.3, 11.11).
9. Open questions: may managers create submissions or approve medium-risk fixes? (designPRD 13; DataBasePRD 10).

## 8. Verified, and not verified

**Verified (2026-11-07):** frontend `tsc`, `eslint`, production build; HTTP access matrix of 210
company x page x user cases, 0 mismatches; guarded routes served `no-store` (no frozen redirect);
browser run in Edge, 20 checks (login, wrong password, role-aware nav, honest KPIs, company switcher
with per-company role, tabs, modal, toast, skip link, no console errors, no horizontal scroll at 360px on
5 pages, drawer); backend 37 tests; SQL 70 expectations on a real local Postgres (2026-11-08, after the creator
merge; includes "agency creator has the same knowledge access as the in-house creator"); the seed
itself runs through the real workflow triggers. Mutation checks (2026-11-07, before the merge):
allowing self-approval was caught; removing one embargo gate was still blocked by the second
layer, and removing both was caught.

**Verified (2026-11-08, admin build):** `tsc`, `eslint`, production build; an end-to-end run against
`next start` in Edge, **74/74**: access matrix (182 cases, 0 mismatches); creator HTML never contains
confidential text (knowledge, dashboard, submissions, held submission shows the restricted message);
agency creator sees the same knowledge as in-house; guessed ids from another company / another
creator / a confidential fact get the not-found page with no data; CSV export allowed for admin only
among tested roles, refused for creator, reviewer, no session and another company's admin; every admin
flow incl. validation and rule errors (invite, role change, suspend cuts access at once, restore,
guideline versioning, fact add/edit/expire with owner alerts, asset, embargo add/lift, campaign rules,
release approved content, agent settings persist, company rename, audit, analytics, notifications);
**a server action submitted with a manager's cookie on an admin form is refused**; invited reviewer
joins and sees reviewer routes only; no console errors; no horizontal scroll at 360px on 12 pages.
Harness: `scratchpad/verify_admin.py` (starts and stops its own server on :3101).

**Verified (2026-11-10, workflow):** backend 38 tests (new: every finding names its rule); SQL 70
(seed gained 3 guidelines); `tsc`, `eslint`, build; `scratchpad/verify_flows.py` **37/37** against a
real backend on :8011 + `next start` on :3101: create -> real check -> 4 auto-fixes as v2; high-risk
findings cite approved sources; creator sees only the restricted message for the embargo; send refused
before intent confirmed; one accepted fix changes only that span (A04) with a visible diff; auto-assign;
reviewer: approve disabled by embargo, reject needs a reason, request changes; resubmit refused without
a new version; edit -> re-check -> resubmit -> approve; editing approved content returns it to review
(A11); manager reassign + release; released content locked; creator blocked from the review screen;
360px clean; **backend stopped -> draft kept with an honest error, no fake result (A13)**. Admin suite
re-run: 74/74 (its secret check now targets the embargo record, since creators may see their own text).

**Not verified:** anything on a real Supabase project (GoTrue login of seeded users; password hashing,
because local Postgres lacks pgcrypto and is stubbed); Storage; frontend-backend calls; browsers other
than Edge; screen readers.

## 9. Gotchas

- Backend tests warn that Starlette prefers `httpx2`. Harmless.
- `next dev` rewrites `frontend/AGENTS.md`; leave it.
- `pgserver`'s Postgres has no `pgcrypto`; `00_local_stub.sql` substitutes non-hashing stand-ins.
- psycopg2 keeps only the last 50 NOTICEs; `run_local.py` runs `rls_test.sql` in sections split on
  `-- ====` lines. Keep each section under 50 expectations.
- In plpgsql, `IF NOT CASE ... END THEN` does not parse; compute the CASE into a variable first.
- **After a server action, use `revalidatePath("/org/[orgId]", "layout")` (helper `rerender()`), not
  `refresh()`.** With cacheComponents + partialPrefetching, `refresh()` sent the fresh tree but the open
  page did not update (verified).
- **React 19 resets a `<form action>` after every submit, even a rejected one.** Forms here submit via
  `submitKeepingValues` (onSubmit + startTransition) so a validation error keeps what was typed.
- **Toast from the action result, not a `useEffect`:** a successful action often removes its own
  button (Expire, Lift, Release), and the unmounted component's effect never runs.
- `notFound()` inside a streamed page answers HTTP 200 with the not-found UI (headers already sent).
  Same outcome for "missing" and "not yours"; tests assert no data in the body, not the status.
- `sr-only` (absolute) children inside an `overflow-x-auto` box escape it unless the box is
  `relative`; that made phones scroll sideways (fixed in `Table`).
- React Compiler lint forbids `Date.now()` in render; server pages use `requestTime()` from `format.ts`.

## 10. Working agreements

- designPRD.md and DataBasePRD.md win over this file; if they disagree, fix this file or raise it.
- Never print `.env` values. Redact by key name and check the output before trusting the redaction.
- Run `tsc`, `eslint`, `pytest` and `supabase/tests/run_local.py` before calling work done; say plainly
  what is unverified.
- A new rule goes in the database first (migration + test in `rls_test.sql`), then the UI.
- When a SQL test passes too easily, break the rule on a scratch copy and confirm it fails.
- Never label mock output or placeholder screens as real (designPRD 11.6).
