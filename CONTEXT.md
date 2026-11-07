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
- **Internal and external creators are one role, `creator`.** `org_memberships.access_scope`
  (`company` / `own_work`) separates them, and only changes which brand knowledge they can read.
- Supabase keys are not set yet; the schema is written and tested locally (section 8).
- `dashboard-reference.png` and `Clearance_HIVEMIND.pdf`, which designPRD cites, are **not in the
  repo**; the visuals follow designPRD's written description and tokens.

**Status (2026-11-07):** foundation. Database layer complete and tested; backend mock aligned; new
theme, shell, company-scoped routes and role guards done. Dashboard, Knowledge Base and the design
system page are real UI; all other screens are clearly labelled placeholders. Nothing reads the
database yet.

---

## 1. Run it

```bash
# Frontend (Next.js 16.4, Cache Components, Tailwind v4)        http://localhost:3000
cd frontend && npm install && npm run dev
npm run build | npm run lint | npx next typegen && npx tsc --noEmit

# Backend (FastAPI, Python 3.11)                                http://localhost:8000/docs
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest                                    # 37 tests

# Database: real migrations + seed + tests on a throwaway local Postgres (no Supabase needed)
pip install pgserver psycopg2-binary && python supabase/tests/run_local.py     # 68 expectations
```

- **Demo sign-in** (password `clearance-demo`): `admin@`, `manager@`, `reviewer@`, `creator@`,
  `agency@sonicx.test`, and `admin@northwind.test`. The agency user belongs to **both** companies
  (external in Sonic X, internal in Northwind) to exercise multi-company access.
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
| `frontend/src/components/layout/` | app-shell, nav-links (grouped), mobile-nav, org-switcher, role-switcher (demo accounts), notifications-panel, user-menu, page-header, placeholder-page |
| `frontend/src/lib/` | `domain.ts` (enums/types), `roles.ts` (nav groups, `PAGE_ROLES`, `orgPath`, `homeFor`), `demo-users.ts`, `session.ts` (**auth seam**, `requireOrg`), `actions/auth.ts` |
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

## 4. Access matrix as built (DataBasePRD 4)

| Data | Admin | Manager | Creator | Reviewer |
|---|---|---|---|---|
| Organization / memberships | Edit | View | Own membership only | Own membership only |
| Guidelines | Edit | View | View | View |
| Assets, facts | Edit | View | View by class: company = public + internal; own_work = public only | View |
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
| Dashboard | Hero + KPI and recent-submissions cards with honest "not connected" states (no data yet) |
| Knowledge Base | Category tabs with empty states |
| Submissions, New submission, Submission detail, Reviews, Review, Campaigns, Source, Embargoes, Analytics, Users & Roles, AI Agent Settings, Notifications, Audit Log, Settings | Labelled placeholders listing what designPRD requires |
| Integrations | Shown as "Soon" (designPRD: future) |

designPRD acceptance (section 9): A02 (external creator cannot read embargo) and A12 (cross-company ID
guess) are **enforced and tested in the database**; A07/A08 holds and A11 stale approval are enforced
in the database; everything else needs the UI wired to data.

## 7. Next steps, in order

1. Add Supabase keys to `.env`, create the project, run migrations + seed, **confirm the demo users can
   sign in** (GoTrue acceptance of seeded auth rows is untested).
2. Wire Supabase Auth into the session seam (`getSessionUser`, actions); keep demo auth behind `ALLOW_DEMO_AUTH`.
3. Server-side data layer and generated types; replace dashboard and list placeholders with real queries.
4. Storage buckets and policies (private, signed URLs); New submission with upload.
5. Backend: verify JWTs, write `ai_checks` / `issues` / `agent_action_log` with the service role.
6. Submission detail (intent, findings with citations, diff, accept/reject per change), Reviews and decisions.
7. Admin screens: knowledge CRUD, embargoes, users & roles, agent settings, audit log.
8. Write `IMPLEMENTATION_PLAN.md` and `KNOWN_LIMITATIONS.md` (designPRD 11.3, 11.11).
9. Open questions: may managers create submissions or approve medium-risk fixes? Can external creators
   read some guidelines? (designPRD 13; DataBasePRD 10).

## 8. Verified, and not verified

**Verified (2026-11-07):** frontend `tsc`, `eslint`, production build; HTTP access matrix of 210
company x page x user cases, 0 mismatches; guarded routes served `no-store` (no frozen redirect);
browser run in Edge, 20 checks (login, wrong password, role-aware nav, honest KPIs, company switcher
with per-company role, tabs, modal, toast, skip link, no console errors, no horizontal scroll at 360px on
5 pages, drawer); backend 37 tests; SQL 68 expectations on a real local Postgres; the seed itself runs
through the real workflow triggers. Mutation checks: making external creators read internal knowledge
and allowing self-approval were each caught; removing one embargo gate was still blocked by the second
layer, and removing both was caught.

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

## 10. Working agreements

- designPRD.md and DataBasePRD.md win over this file; if they disagree, fix this file or raise it.
- Never print `.env` values. Redact by key name and check the output before trusting the redaction.
- Run `tsc`, `eslint`, `pytest` and `supabase/tests/run_local.py` before calling work done; say plainly
  what is unverified.
- A new rule goes in the database first (migration + test in `rls_test.sql`), then the UI.
- When a SQL test passes too easily, break the rule on a scratch copy and confirm it fails.
- Never label mock output or placeholder screens as real (designPRD 11.6).
