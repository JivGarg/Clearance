-- Clearance: row-level security implementing the access matrix (DataBasePRD.md section 4).
-- Every policy is scoped through an ACTIVE membership in the row's company, so rows from another
-- company are never visible (rule 1, NFR "zero cross-company reads").
--
-- One creator role. access_scope separates internal (company) from external (own_work) creators,
-- and only changes which brand knowledge they may read (visibility classes, see 0002).
--
-- Matrix decisions where DataBasePRD leaves room (listed in CONTEXT.md):
--  * Everyone reads their own membership and user row, so the app can know who and what they are.
--  * Staff (admin, manager, reviewer) read the names of users in their companies; creators only
--    see staff names, never other creators.
--  * Brand guidelines have no visibility column, so every active member reads them.
--  * Only creators create submissions (matrix: "Create/edit own").

alter table public.organizations      enable row level security;
alter table public.users              enable row level security;
alter table public.org_memberships    enable row level security;
alter table public.brand_guidelines   enable row level security;
alter table public.brand_assets       enable row level security;
alter table public.approved_facts     enable row level security;
alter table public.embargoes          enable row level security;
alter table public.campaigns          enable row level security;
alter table public.submissions        enable row level security;
alter table public.revisions          enable row level security;
alter table public.review_assignments enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.ai_checks          enable row level security;
alter table public.issues             enable row level security;
alter table public.agent_action_log   enable row level security;
alter table public.notifications      enable row level security;

-- ---------------------------------------------------------------- organization, people

create policy organizations_select on public.organizations for select to authenticated
  using (public.member_role(organization_id) is not null);
create policy organizations_admin_update on public.organizations for update to authenticated
  using (public.member_role(organization_id) = 'admin')
  with check (public.member_role(organization_id) = 'admin');

-- Self, or anyone who shares a company where the viewer is staff. Creators see staff, not peers.
create or replace function public.can_see_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_user = public.app_user_id()
      or exists (
        select 1
          from public.org_memberships mine
          join public.org_memberships theirs on theirs.organization_id = mine.organization_id
         where mine.user_id = public.app_user_id() and mine.status = 'active'
           and theirs.user_id = p_user
           and (mine.role in ('admin', 'manager', 'reviewer') or theirs.role <> 'creator'))
$$;

create policy users_select on public.users for select to authenticated
  using (public.can_see_user(user_id));
create policy users_update_self on public.users for update to authenticated
  using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());

-- Matrix: admin edit, manager view, others none (but everyone sees their own membership).
create policy memberships_select on public.org_memberships for select to authenticated
  using (user_id = public.app_user_id()
         or public.member_role(organization_id) in ('admin', 'manager'));
create policy memberships_admin_insert on public.org_memberships for insert to authenticated
  with check (public.member_role(organization_id) = 'admin');
create policy memberships_admin_update on public.org_memberships for update to authenticated
  using (public.member_role(organization_id) = 'admin')
  with check (public.member_role(organization_id) = 'admin');

-- ---------------------------------------------------------------- brand knowledge

create policy guidelines_select on public.brand_guidelines for select to authenticated
  using (public.member_role(organization_id) is not null);
create policy guidelines_admin_write on public.brand_guidelines for all to authenticated
  using (public.member_role(organization_id) = 'admin')
  with check (public.member_role(organization_id) = 'admin');

create policy assets_select on public.brand_assets for select to authenticated
  using (public.can_see_class(organization_id, visibility));
create policy assets_admin_write on public.brand_assets for all to authenticated
  using (public.member_role(organization_id) = 'admin')
  with check (public.member_role(organization_id) = 'admin');

create policy facts_select on public.approved_facts for select to authenticated
  using (public.can_see_class(organization_id, confidentiality_level));
create policy facts_admin_write on public.approved_facts for all to authenticated
  using (public.member_role(organization_id) = 'admin')
  with check (public.member_role(organization_id) = 'admin');

-- Matrix: admin and manager edit; creators view subject to visibility; reviewers view.
create policy embargoes_select on public.embargoes for select to authenticated
  using (public.can_see_class(organization_id, visibility));
create policy embargoes_staff_write on public.embargoes for all to authenticated
  using (public.member_role(organization_id) in ('admin', 'manager'))
  with check (public.member_role(organization_id) in ('admin', 'manager'));

create policy campaigns_select on public.campaigns for select to authenticated
  using (public.member_role(organization_id) is not null);
create policy campaigns_staff_write on public.campaigns for all to authenticated
  using (public.member_role(organization_id) in ('admin', 'manager'))
  with check (public.member_role(organization_id) in ('admin', 'manager'));

-- ---------------------------------------------------------------- review workflow

create policy submissions_select on public.submissions for select to authenticated
  using (public.can_view_submission(submission_id));
create policy submissions_creator_insert on public.submissions for insert to authenticated
  with check (public.member_role(organization_id) = 'creator'
              and created_by_user_id = public.app_user_id()
              and status = 'draft');
-- What may change, and by whom, is decided by the trigger in 0002. No delete (rule 6).
create policy submissions_update on public.submissions for update to authenticated
  using (public.can_view_submission(submission_id))
  with check (public.can_view_submission(submission_id));

create policy revisions_select on public.revisions for select to authenticated
  using (public.can_view_submission(submission_id));
create policy revisions_creator_insert on public.revisions for insert to authenticated
  with check (edited_by_user_id = public.app_user_id()
              and exists (select 1 from public.submissions s
                           where s.submission_id = revisions.submission_id
                             and s.created_by_user_id = public.app_user_id()
                             and public.member_role(s.organization_id) = 'creator'));

-- Matrix: admin view, manager edit, reviewer view own.
create policy assignments_select on public.review_assignments for select to authenticated
  using (reviewer_user_id = public.app_user_id()
         or exists (select 1 from public.submissions s
                     where s.submission_id = review_assignments.submission_id
                       and public.member_role(s.organization_id) in ('admin', 'manager')));
create policy assignments_manager_insert on public.review_assignments for insert to authenticated
  with check (exists (select 1 from public.submissions s
                       where s.submission_id = review_assignments.submission_id
                         and public.member_role(s.organization_id) = 'manager'));
create policy assignments_manager_update on public.review_assignments for update to authenticated
  using (exists (select 1 from public.submissions s
                  where s.submission_id = review_assignments.submission_id
                    and public.member_role(s.organization_id) = 'manager'))
  with check (exists (select 1 from public.submissions s
                       where s.submission_id = review_assignments.submission_id
                         and public.member_role(s.organization_id) = 'manager'));

-- Matrix: admin + manager view, creator view on own, reviewer create on assigned (and see them).
create policy decisions_select on public.approval_decisions for select to authenticated
  using (public.can_view_submission(submission_id));
create policy decisions_reviewer_insert on public.approval_decisions for insert to authenticated
  with check (reviewer_user_id = public.app_user_id());   -- the trigger checks eligibility + assignment

-- AI checks and issues are written by the system only. Creators do not see findings whose source
-- they are not allowed to read; restricted_issue_count() tells the UI that something is held.
create policy ai_checks_select on public.ai_checks for select to authenticated
  using (public.can_view_submission(submission_id));
create policy issues_select on public.issues for select to authenticated
  using (exists (select 1 from public.ai_checks c join public.submissions s on s.submission_id = c.submission_id
                  where c.check_id = issues.check_id
                    and public.can_view_submission(s.submission_id)
                    and public.can_see_source(s.organization_id, issues.source_type, issues.source_id)));

-- Matrix: admin and manager only.
create policy agent_log_select on public.agent_action_log for select to authenticated
  using (exists (select 1 from public.submissions s
                  where s.submission_id = agent_action_log.submission_id
                    and public.member_role(s.organization_id) in ('admin', 'manager')));

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_user_id = public.app_user_id());
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_user_id = public.app_user_id()) with check (recipient_user_id = public.app_user_id());

-- ---------------------------------------------------------------- privileges

revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon, public;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;

-- Column limits: a user may change only their own name, and only mark notifications read.
revoke update on public.users         from authenticated;
grant  update (name) on public.users  to authenticated;
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

grant execute on function
  public.is_system_actor(), public.app_user_id(), public.member_role(uuid), public.member_scope(uuid),
  public.can_see_class(uuid, public.visibility_class), public.can_view_submission(uuid),
  public.can_see_source(uuid, public.source_type, uuid), public.restricted_issue_count(uuid),
  public.latest_revision_id(uuid), public.has_active_embargo(uuid), public.is_active_reviewer(uuid, uuid),
  public.can_see_user(uuid)
to authenticated, service_role;
