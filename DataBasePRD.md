# Clearance: Database PRD

**Version:** 1.0 | **Date:** 2026-11-07 | **Status:** Draft for review
**Source:** Clearance ER diagram (16 tables, 4 roles)

---

## 1. Purpose

Clearance lets a company review content (submissions) against its own brand rules and approved facts before release. The database must:

1. Keep each company's data private from every other company.
2. Give each user only the access their role allows.
3. Keep a full, auditable history of every submission, edit, AI check and decision.

## 2. Scope

**In scope:** schema, relationships, roles and access rules, data integrity, audit trail, performance and retention targets.
**Out of scope:** UI, AI model internals, file-storage implementation (the database stores paths only).

## 3. Core design decisions

| # | Decision | Reason |
|---|----------|--------|
| 1 | One `users` table, not one per role | Role lives in `org_memberships`, so role changes need no data move |
| 2 | Every company-owned row carries `organization_id` | Simple, enforceable tenant isolation |
| 3 | A user can belong to many companies, with one role per company | Supports agencies and external creators |
| 4 | Submissions are never edited in place; changes create a `revisions` row | Full version history |
| 5 | Every AI action is logged with a reason and undo data | Transparency and reversibility |

## 4. Roles

Stored in `org_memberships.role`.

| Role | Purpose |
|------|---------|
| `admin` | Manages company, users, brand rules |
| `manager` | Assigns reviewers, oversees campaigns |
| `creator` | Creates and revises content (internal or external, set by `access_scope`) |
| `reviewer` | Reviews, approves or rejects (Authorised reviewer) |

`access_scope` limits what a membership can see, e.g. `own_work` for external creators, `company` for internal staff.

### Access matrix (proposed, confirm with product)

| Data | Admin | Manager | Creator | Reviewer |
|------|:-----:|:-------:|:-------:|:--------:|
| Organization, memberships | Edit | View | None | None |
| Brand guidelines, assets, approved facts | Edit | View | View | View |
| Embargoes | Edit | Edit | View (visibility rules apply) | View |
| Campaigns | Edit | Edit | View | View |
| Submissions | View | View | Create/edit own | View assigned |
| Revisions | View | View | Create on own | View assigned |
| Review assignments | View | Edit | None | View own |
| Approval decisions | View | View | View on own | Create on assigned |
| AI checks, issues | View | View | View on own | View assigned |
| Agent action log | View | View | None | None |
| Notifications | Own only | Own only | Own only | Own only |

## 5. Tables

Types: `uuid` for all keys, `timestamptz` for all times. All tables also carry `created_at`; mutable tables carry `updated_at`.

### 5.1 People and access

| Table | Columns | Notes |
|-------|---------|-------|
| `organizations` | **PK** organization_id, company_name, created_at | Tenant root |
| `users` | **PK** user_id, name, email (unique), auth_user_id (unique) | `auth_user_id` links to the login provider |
| `org_memberships` | **PK** membership_id, **FK** organization_id, **FK** user_id, role, status, access_scope | Unique on (organization_id, user_id). `status`: invited, active, suspended |

### 5.2 Company-owned data

| Table | Columns | Notes |
|-------|---------|-------|
| `brand_guidelines` | **PK** guideline_id, **FK** organization_id, rule, category, version | Versioned rules |
| `brand_assets` | **PK** asset_id, **FK** organization_id, storage_path, asset_type, visibility | File stays in storage; row holds the path |
| `approved_facts` | **PK** fact_id, **FK** organization_id, fact, source, valid_until, confidentiality_level | Expired facts must not pass checks |
| `embargoes` | **PK** embargo_id, **FK** organization_id, restricted_item, release_at, visibility | Blocks content until `release_at` |
| `campaigns` | **PK** campaign_id, **FK** organization_id, campaign_name, start_date, end_date | Optional grouping for submissions |

### 5.3 Review workflow

| Table | Columns | Notes |
|-------|---------|-------|
| `submissions` | **PK** submission_id, **FK** organization_id, **FK** campaign_id (nullable), **FK** created_by_user_id, content_path, type, channel, status, intent_summary | `status`: draft, in_review, changes_requested, approved, rejected, released |
| `revisions` | **PK** revision_id, **FK** submission_id, **FK** edited_by_user_id, version, content_path, change_summary | Unique on (submission_id, version) |
| `review_assignments` | **PK** assignment_id, **FK** submission_id, **FK** reviewer_user_id, deadline, status | `status`: pending, done, overdue |
| `approval_decisions` | **PK** decision_id, **FK** submission_id, **FK** reviewer_user_id, decision, comments, decided_at | `decision`: approved, rejected, changes_requested. Append-only |
| `ai_checks` | **PK** check_id, **FK** submission_id, risk_level, checked_at, service_used, result | `risk_level`: low, medium, high |
| `issues` | **PK** issue_id, **FK** check_id, issue_type, explanation, source_type, source_id, risk_level, suggested_fix | `source_type` and `source_id` point to the guideline, fact or embargo that was broken |
| `agent_action_log` | **PK** action_id, **FK** submission_id, action, reason, undo_data | Append-only |
| `notifications` | **PK** notification_id, **FK** recipient_user_id, **FK** submission_id (nullable), message, read_at | Null `read_at` means unread |

## 6. Relationships

All are one-to-many (parent first).

| Parent | Child | Meaning |
|--------|-------|---------|
| organizations | org_memberships, brand_guidelines, brand_assets, approved_facts, embargoes, campaigns, submissions | Company owns it |
| users | org_memberships | User holds a role in a company |
| users | submissions | Creates |
| users | revisions | Edits |
| users | review_assignments | Is assigned to review |
| users | approval_decisions | Decides |
| users | notifications | Receives |
| campaigns | submissions | Groups (optional) |
| submissions | revisions, review_assignments, approval_decisions, ai_checks, agent_action_log, notifications | Review flow |
| ai_checks | issues | Raises |

## 7. Integrity rules

1. **Tenant match:** a child row's `organization_id` (directly or through its parent) must equal its submission's company. Enforce with row-level security.
2. **Role check:** `role` is limited to the four values above (enum or check constraint).
3. **Reviewer eligibility:** `review_assignments.reviewer_user_id` and `approval_decisions.reviewer_user_id` must have an active `reviewer` membership in that company.
4. **No self-approval:** a reviewer cannot decide on a submission they created.
5. **Append-only:** `approval_decisions`, `revisions` and `agent_action_log` allow insert and read only.
6. **Delete behavior:** no hard deletes on submissions or their children; use status changes. Deleting an organization is blocked while submissions exist.
7. **Embargo and fact checks:** AI checks must read only facts where `valid_until` is null or in the future, and embargoes not yet released.

## 8. Indexes (minimum)

- `org_memberships (user_id, organization_id)` unique
- `submissions (organization_id, status, created_at desc)`
- `submissions (created_by_user_id)`, `submissions (campaign_id)`
- `revisions (submission_id, version)` unique
- `review_assignments (reviewer_user_id, status, deadline)`
- `notifications (recipient_user_id, read_at)`
- `issues (check_id)`, `ai_checks (submission_id)`
- `approved_facts (organization_id, valid_until)`
- `embargoes (organization_id, release_at)`

## 9. Non-functional requirements

| Area | Target |
|------|--------|
| Isolation | Zero cross-company reads, verified by automated tests |
| Availability | 99.9% with daily backups and point-in-time recovery |
| Read speed | Submission list under 300 ms at p95 for 100k submissions per company |
| Audit | Every decision, revision and AI action traceable to a user or agent and a time |
| Retention | Submissions, revisions, decisions and logs kept at least 7 years (confirm with legal) |
| Privacy | Email and name are personal data; support export and deletion requests |
| Secrets | No credentials or file contents in the database, only paths |

## 10. Open questions

1. Final permissions in the access matrix (section 4) need sign-off.
2. Can one user hold different roles in different companies? (Assumed yes.)
3. How should `access_scope` values be defined: a fixed list or per-company rules?
4. Is the 7-year retention period right for all regions?
5. Should notifications be limited by role or channel preferences?
6. Should `approved_facts.confidentiality_level` hide facts from certain roles?

## 11. Acceptance criteria

- [ ] All 16 tables created with the keys and constraints above
- [ ] Row-level security blocks cross-company access in tests
- [ ] Each role can do exactly what the access matrix allows, no more
- [ ] Append-only tables reject updates and deletes
- [ ] Migration, seed data and rollback scripts reviewed
