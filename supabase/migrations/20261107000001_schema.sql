-- Clearance: schema (DataBasePRD.md, sections 5, 6 and 8).
-- 16 tables, multi-tenant: every company-owned row carries organization_id.
-- Order: 0001 schema, 0002 integrity rules (functions + triggers), 0003 row-level security.
--
-- Additions beyond DataBasePRD.md (documented in CONTEXT.md):
--   * ai_checks.revision_id and approval_decisions.revision_id, so a check or an approval is tied
--     to the exact revision it looked at (designPRD 4.8: approving revision A must not approve B).
--   * visibility_class values come from designPRD 4.2.

-- ---------------------------------------------------------------- enums

create type public.member_role       as enum ('admin', 'manager', 'creator', 'reviewer');
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.visibility_class  as enum ('public_to_creators', 'internal', 'confidential', 'local_only');

create type public.submission_status as enum
  ('draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'released');
create type public.content_type      as enum ('text', 'image', 'document', 'video');
create type public.channel           as enum ('instagram', 'youtube', 'linkedin', 'blog', 'email', 'other');
create type public.risk_level        as enum ('low', 'medium', 'high');
create type public.assignment_status as enum ('pending', 'done', 'overdue');
create type public.decision_kind     as enum ('approved', 'rejected', 'changes_requested');
create type public.source_type       as enum ('guideline', 'fact', 'embargo', 'asset');

-- ---------------------------------------------------------------- 5.1 people and access

create table public.organizations (
  organization_id uuid primary key default gen_random_uuid(),
  company_name    text not null check (length(btrim(company_name)) > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.users (
  user_id      uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  auth_user_id uuid unique references auth.users (id) on delete set null, -- login provider link
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.org_memberships (
  membership_id   uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id),
  user_id         uuid not null references public.users (user_id),
  role            public.member_role not null,
  status          public.membership_status not null default 'invited',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index org_memberships_user_org_uidx on public.org_memberships (user_id, organization_id);

-- ---------------------------------------------------------------- 5.2 company-owned data

create table public.brand_guidelines (
  guideline_id    uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id),
  rule            text not null,
  category        text not null,
  version         int  not null default 1 check (version >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.brand_assets (
  asset_id        uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id),
  storage_path    text not null,   -- path only; the file lives in storage
  asset_type      text not null,
  visibility      public.visibility_class not null default 'internal',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.approved_facts (
  fact_id               uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (organization_id),
  fact                  text not null,
  source                text not null,
  valid_until           timestamptz,  -- null = no expiry
  confidentiality_level public.visibility_class not null default 'internal',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index approved_facts_org_valid_idx on public.approved_facts (organization_id, valid_until);

create table public.embargoes (
  embargo_id      uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id),
  restricted_item text not null,
  release_at      timestamptz not null,
  visibility      public.visibility_class not null default 'confidential',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index embargoes_org_release_idx on public.embargoes (organization_id, release_at);

create table public.campaigns (
  campaign_id     uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id),
  campaign_name   text not null,
  start_date      date,
  end_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  -- target for the composite FK below: a submission's campaign must be in the same company
  unique (campaign_id, organization_id)
);

-- ---------------------------------------------------------------- 5.3 review workflow

create table public.submissions (
  submission_id      uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (organization_id),
  campaign_id        uuid,
  created_by_user_id uuid not null references public.users (user_id),
  content_path       text not null,
  type               public.content_type not null,
  channel            public.channel not null,
  status             public.submission_status not null default 'draft',
  intent_summary     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Integrity rule 1 (tenant match) for campaigns, enforced by the key itself.
  foreign key (campaign_id, organization_id) references public.campaigns (campaign_id, organization_id)
);
create index submissions_org_status_created_idx on public.submissions (organization_id, status, created_at desc);
create index submissions_creator_idx  on public.submissions (created_by_user_id);
create index submissions_campaign_idx on public.submissions (campaign_id);

create table public.revisions (
  revision_id       uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references public.submissions (submission_id),
  edited_by_user_id uuid not null references public.users (user_id),
  version           int  not null check (version >= 1),
  content_path      text not null,
  change_summary    text,
  created_at        timestamptz not null default now()   -- append-only: no updated_at
);
create unique index revisions_submission_version_uidx on public.revisions (submission_id, version);

create table public.review_assignments (
  assignment_id    uuid primary key default gen_random_uuid(),
  submission_id    uuid not null references public.submissions (submission_id),
  reviewer_user_id uuid not null references public.users (user_id),
  deadline         timestamptz,
  status           public.assignment_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index review_assignments_reviewer_idx on public.review_assignments (reviewer_user_id, status, deadline);
create index review_assignments_submission_idx on public.review_assignments (submission_id);

create table public.approval_decisions (
  decision_id      uuid primary key default gen_random_uuid(),
  submission_id    uuid not null references public.submissions (submission_id),
  revision_id      uuid not null references public.revisions (revision_id),
  reviewer_user_id uuid not null references public.users (user_id),
  decision         public.decision_kind not null,
  comments         text,
  decided_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  -- A rejection or change request must say why.
  check (decision = 'approved' or length(btrim(coalesce(comments, ''))) > 0)
);
create index approval_decisions_submission_idx on public.approval_decisions (submission_id);

create table public.ai_checks (
  check_id      uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (submission_id),
  revision_id   uuid references public.revisions (revision_id),
  risk_level    public.risk_level not null,
  checked_at    timestamptz not null default now(),
  service_used  text not null,   -- e.g. 'mock-rules-v1'; never pretend a mock is a model
  result        jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index ai_checks_submission_idx on public.ai_checks (submission_id);

create table public.issues (
  issue_id      uuid primary key default gen_random_uuid(),
  check_id      uuid not null references public.ai_checks (check_id),
  issue_type    text not null,
  explanation   text not null check (length(btrim(explanation)) > 0),
  source_type   public.source_type not null,   -- every finding cites what it is based on
  source_id     uuid not null,                 -- guideline / fact / embargo / asset id (checked by trigger)
  risk_level    public.risk_level not null,
  suggested_fix text,
  created_at    timestamptz not null default now()
);
create index issues_check_idx on public.issues (check_id);

create table public.agent_action_log (
  action_id     uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (submission_id),
  action        text not null,
  reason        text not null,
  undo_data     jsonb,
  created_at    timestamptz not null default now()
);
create index agent_action_log_submission_idx on public.agent_action_log (submission_id, created_at desc);

create table public.notifications (
  notification_id   uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (user_id),
  submission_id     uuid references public.submissions (submission_id),
  message           text not null,
  read_at           timestamptz,   -- null = unread
  created_at        timestamptz not null default now()
);
create index notifications_recipient_read_idx on public.notifications (recipient_user_id, read_at);

-- ---------------------------------------------------------------- integrity rule 7 helpers

-- Checks must only read facts still valid and embargoes not yet released. These views are
-- security_invoker, so row-level security on the base tables still applies to whoever reads them.
create view public.current_facts with (security_invoker = true) as
  select * from public.approved_facts where valid_until is null or valid_until > now();

create view public.active_embargoes with (security_invoker = true) as
  select * from public.embargoes where release_at > now();
