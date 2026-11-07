-- Clearance: integrity rules (DataBasePRD.md section 7) as functions and triggers, so they hold for
-- every client: the UI, the backend (service role) and raw SQL.

-- ---------------------------------------------------------------- identity helpers

-- True for the backend / agent (service role) and for SQL sessions with no signed-in user
-- (migrations, seed). Inside our own SECURITY DEFINER trigger functions current_user is the owner,
-- so their writes count as system writes; those functions do their own checks first.
create or replace function public.is_system_actor() returns boolean
language sql stable as $$
  select auth.uid() is null or current_user not in ('authenticated', 'anon')
$$;

-- The signed-in person's row in public.users.
create or replace function public.app_user_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select user_id from public.users where auth_user_id = auth.uid()
$$;

-- Caller's role in a company, counting ACTIVE memberships only (invited and suspended members have
-- no access).
create or replace function public.member_role(p_org uuid) returns public.member_role
language sql stable security definer set search_path = public, pg_temp as $$
  select m.role from public.org_memberships m
   where m.organization_id = p_org and m.user_id = public.app_user_id() and m.status = 'active'
$$;

-- Visibility classes (designPRD 4.2). Staff see everything. Creators, internal or external alike
-- (one role, one access level; team decision overriding DataBasePRD's access_scope), see public +
-- internal knowledge, never confidential or local-only.
create or replace function public.can_see_class(p_org uuid, p_class public.visibility_class) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case public.member_role(p_org)
           when 'admin'    then true
           when 'manager'  then true
           when 'reviewer' then true
           when 'creator'  then p_class in ('public_to_creators', 'internal')
           else false
         end
$$;

-- Who can see a submission (access matrix, DataBasePRD 4): admin and manager of its company, its
-- creator, and reviewers assigned to it. Children (revisions, checks, issues, decisions) defer here.
create or replace function public.can_view_submission(p_submission uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.submissions s
     where s.submission_id = p_submission
       and case public.member_role(s.organization_id)
             when 'admin'    then true
             when 'manager'  then true
             when 'creator'  then s.created_by_user_id = public.app_user_id()
             when 'reviewer' then exists (
                                    select 1 from public.review_assignments a
                                     where a.submission_id = s.submission_id
                                       and a.reviewer_user_id = public.app_user_id())
             else false
           end
  )
$$;

-- Can the caller see the source an issue cites? Creators must never read restricted source details
-- (designPRD 4.5 / 4.9); the issue row is hidden from them and the UI shows a generic hold reason.
create or replace function public.can_see_source(p_org uuid, p_type public.source_type, p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case p_type
    when 'guideline' then public.member_role(p_org) is not null
    when 'fact'      then exists (select 1 from public.approved_facts f
                                   where f.fact_id = p_id and public.can_see_class(p_org, f.confidentiality_level))
    when 'embargo'   then exists (select 1 from public.embargoes e
                                   where e.embargo_id = p_id and public.can_see_class(p_org, e.visibility))
    when 'asset'     then exists (select 1 from public.brand_assets a
                                   where a.asset_id = p_id and public.can_see_class(p_org, a.visibility))
  end
$$;

-- How many findings on a submission the caller cannot see. Lets the UI say "Restricted information
-- requires internal review" without revealing what it is (designPRD 4.9).
create or replace function public.restricted_issue_count(p_submission uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case when not public.can_view_submission(p_submission) then 0 else (
    select count(*)::int
      from public.issues i
      join public.ai_checks c   on c.check_id = i.check_id
      join public.submissions s on s.submission_id = c.submission_id
     where s.submission_id = p_submission
       and not public.can_see_source(s.organization_id, i.source_type, i.source_id))
  end
$$;

create or replace function public.latest_revision_id(p_submission uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select revision_id from public.revisions
   where submission_id = p_submission order by version desc limit 1
$$;

-- An unreleased embargo is cited by a check on the current revision (or by a check not tied to a
-- revision). Such content cannot be approved or released (designPRD 4.9).
create or replace function public.has_active_embargo(p_submission uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.issues i
      join public.ai_checks c on c.check_id = i.check_id
      join public.embargoes e on e.embargo_id = i.source_id
     where c.submission_id = p_submission
       and i.source_type = 'embargo'
       and e.release_at > now()
       and (c.revision_id is null or c.revision_id = public.latest_revision_id(p_submission))
  )
$$;

-- ---------------------------------------------------------------- generic triggers

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations', 'users', 'org_memberships', 'brand_guidelines', 'brand_assets',
                           'approved_facts', 'embargoes', 'campaigns', 'submissions', 'review_assignments']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;
end $$;

-- Rule 5: append-only. Applies to everyone, including the service role.
create or replace function public.forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only: rows cannot be updated or deleted', tg_table_name
    using errcode = '42501';
end $$;

create trigger approval_decisions_append_only before update or delete on public.approval_decisions
  for each row execute function public.forbid_change();
create trigger revisions_append_only before update or delete on public.revisions
  for each row execute function public.forbid_change();
create trigger agent_action_log_append_only before update or delete on public.agent_action_log
  for each row execute function public.forbid_change();

-- Rule 6: no hard deletes on submissions or their children; use status changes.
-- (Deleting an organization is blocked by its foreign keys while any submission exists.)
create or replace function public.forbid_delete() returns trigger language plpgsql as $$
begin
  raise exception 'rows in % cannot be deleted; change their status instead', tg_table_name
    using errcode = '42501';
end $$;

create trigger submissions_no_delete         before delete on public.submissions        for each row execute function public.forbid_delete();
create trigger review_assignments_no_delete  before delete on public.review_assignments for each row execute function public.forbid_delete();
create trigger ai_checks_no_delete           before delete on public.ai_checks          for each row execute function public.forbid_delete();
create trigger issues_no_delete              before delete on public.issues             for each row execute function public.forbid_delete();
create trigger notifications_no_delete       before delete on public.notifications      for each row execute function public.forbid_delete();

-- ---------------------------------------------------------------- tenant match (rule 1)

-- Any reviewer named on an assignment or decision must hold an ACTIVE reviewer membership in the
-- submission's company (rule 3).
create or replace function public.is_active_reviewer(p_user uuid, p_submission uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.org_memberships m
      join public.submissions s on s.organization_id = m.organization_id
     where s.submission_id = p_submission and m.user_id = p_user
       and m.role = 'reviewer' and m.status = 'active')
$$;

create or replace function public.check_assignment() returns trigger language plpgsql as $$
begin
  if not public.is_active_reviewer(new.reviewer_user_id, new.submission_id) then
    raise exception 'assignee must be an active reviewer in this company' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger review_assignments_check before insert or update of reviewer_user_id, submission_id
  on public.review_assignments for each row execute function public.check_assignment();

-- A check's revision must belong to the same submission.
create or replace function public.check_ai_check() returns trigger language plpgsql as $$
begin
  if new.revision_id is not null and not exists (
    select 1 from public.revisions r where r.revision_id = new.revision_id and r.submission_id = new.submission_id) then
    raise exception 'revision does not belong to this submission' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger ai_checks_check before insert or update on public.ai_checks
  for each row execute function public.check_ai_check();

-- An issue's source must exist in the same company as the submission it was raised on.
create or replace function public.check_issue_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid;
  v_ok  boolean;
begin
  select s.organization_id into v_org
    from public.ai_checks c join public.submissions s on s.submission_id = c.submission_id
   where c.check_id = new.check_id;

  -- (computed into a variable: a CASE inside IF ... THEN confuses the plpgsql parser)
  v_ok := case new.source_type
    when 'guideline' then exists (select 1 from public.brand_guidelines where guideline_id = new.source_id and organization_id = v_org)
    when 'fact'      then exists (select 1 from public.approved_facts  where fact_id      = new.source_id and organization_id = v_org)
    when 'embargo'   then exists (select 1 from public.embargoes       where embargo_id   = new.source_id and organization_id = v_org)
    when 'asset'     then exists (select 1 from public.brand_assets    where asset_id     = new.source_id and organization_id = v_org)
  end;

  if not coalesce(v_ok, false) then
    raise exception 'issue source % % not found in this company', new.source_type, new.source_id
      using errcode = '23503';
  end if;
  return new;
end $$;

create trigger issues_check_source before insert or update on public.issues
  for each row execute function public.check_issue_source();

-- ---------------------------------------------------------------- submissions

-- Allowed status moves and who makes them. Decisions (approved / rejected / changes_requested)
-- only arrive through approval_decisions, which writes the status as the system.
--   draft             -> in_review          creator (own), system
--   changes_requested -> in_review          creator (own, after a new revision), system
--   in_review         -> approved|rejected|changes_requested   system (from a decision)
--   approved          -> released           admin, manager, system   (no active embargo)
--   approved          -> in_review          system (a new revision makes the approval stale)
--   rejected, released: final
create or replace function public.enforce_submission_update() returns trigger language plpgsql as $$
declare
  v_system boolean := public.is_system_actor();
  v_role   public.member_role;
  v_me     uuid;
  v_move   text := old.status || '>' || new.status;
begin
  if new.organization_id <> old.organization_id or new.created_by_user_id <> old.created_by_user_id then
    raise exception 'company and creator of a submission cannot change' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (v_move = any (array[
      'draft>in_review', 'changes_requested>in_review',
      'in_review>approved', 'in_review>rejected', 'in_review>changes_requested',
      'approved>released', 'approved>in_review'])) then
      raise exception 'illegal status change: % to %', old.status, new.status using errcode = '23514';
    end if;

    if new.status in ('approved', 'released') and public.has_active_embargo(new.submission_id) then
      raise exception 'cannot %: content mentions an item under an active embargo', new.status
        using errcode = '23514';
    end if;
  end if;

  if v_system then
    return new;
  end if;

  v_role := public.member_role(new.organization_id);
  v_me   := public.app_user_id();

  if v_role = 'creator' and old.created_by_user_id = v_me then
    if new.status is distinct from old.status then
      if v_move not in ('draft>in_review', 'changes_requested>in_review') then
        raise exception 'a creator cannot move a submission from % to %', old.status, new.status
          using errcode = '42501';
      end if;
      if not exists (select 1 from public.revisions where submission_id = new.submission_id) then
        raise exception 'add a revision before sending for review' using errcode = '23514';
      end if;
      if v_move = 'changes_requested>in_review' and not exists (
        select 1 from public.revisions r
         where r.submission_id = new.submission_id
           and r.created_at > (select max(decided_at) from public.approval_decisions d
                                where d.submission_id = new.submission_id)) then
        raise exception 'upload a new revision before resubmitting' using errcode = '23514';
      end if;
    end if;
    -- Content details only while still a draft; intent while it can still change.
    if old.status <> 'draft' and (new.content_path, new.type, new.channel, new.campaign_id)
                                 is distinct from (old.content_path, old.type, old.channel, old.campaign_id) then
      raise exception 'after the draft stage, change content by adding a revision' using errcode = '42501';
    end if;
    if old.status not in ('draft', 'changes_requested') and new.intent_summary is distinct from old.intent_summary then
      raise exception 'intent can only change in draft or after changes are requested' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_role in ('admin', 'manager') then
    if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at'])
       or v_move <> 'approved>released' then
      raise exception 'admins and managers can only release approved content' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'not allowed to change this submission' using errcode = '42501';
end $$;

create trigger submissions_enforce_update before update on public.submissions
  for each row execute function public.enforce_submission_update();

-- ---------------------------------------------------------------- revisions

-- Numbering is automatic (max + 1). The creator adds revisions to their own submission.
create or replace function public.before_revision_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_next   int;
  v_status public.submission_status;
begin
  select coalesce(max(version), 0) + 1 into v_next from public.revisions where submission_id = new.submission_id;
  if new.version is null then
    new.version := v_next;
  elsif new.version <> v_next then
    raise exception 'next version must be %', v_next using errcode = '23514';
  end if;

  select status into v_status from public.submissions where submission_id = new.submission_id;
  if v_status in ('rejected', 'released') then
    raise exception 'a % submission cannot get new revisions', v_status using errcode = '23514';
  end if;
  return new;
end $$;

create trigger revisions_before_insert before insert on public.revisions
  for each row execute function public.before_revision_insert();

-- The submission points at its newest content. A revision of approved content makes the approval
-- stale: it goes back to review (designPRD 4.8, "approval of revision A does not approve B").
create or replace function public.after_revision_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.submissions
     set content_path = new.content_path,
         status = case when status = 'approved' then 'in_review'::public.submission_status else status end
   where submission_id = new.submission_id;
  return null;
end $$;

create trigger revisions_after_insert after insert on public.revisions
  for each row execute function public.after_revision_insert();

-- ---------------------------------------------------------------- approval decisions

create or replace function public.before_decision_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.submissions;
begin
  select * into s from public.submissions where submission_id = new.submission_id;

  if s.status <> 'in_review' then
    raise exception 'only submissions in review can be decided (this one is %)', s.status using errcode = '23514';
  end if;
  -- Rule 3: eligibility.
  if not public.is_active_reviewer(new.reviewer_user_id, new.submission_id) then
    raise exception 'decider must be an active reviewer in this company' using errcode = '42501';
  end if;
  if not exists (select 1 from public.review_assignments a
                  where a.submission_id = new.submission_id and a.reviewer_user_id = new.reviewer_user_id
                    and a.status in ('pending', 'overdue')) then
    raise exception 'reviewer has no open assignment for this submission' using errcode = '42501';
  end if;
  -- Rule 4: no self-approval.
  if new.reviewer_user_id = s.created_by_user_id then
    raise exception 'a reviewer cannot decide on their own submission' using errcode = '42501';
  end if;
  -- A decision is about one exact revision: the current one.
  if new.revision_id is distinct from public.latest_revision_id(new.submission_id) then
    raise exception 'decide on the latest revision' using errcode = '23514';
  end if;
  if new.decision = 'approved' and public.has_active_embargo(new.submission_id) then
    raise exception 'cannot approve: content mentions an item under an active embargo' using errcode = '23514';
  end if;

  new.decided_at := now();
  return new;
end $$;

create trigger approval_decisions_before_insert before insert on public.approval_decisions
  for each row execute function public.before_decision_insert();

-- Apply the decision: status, close the assignment, tell the creator.
create or replace function public.after_decision_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.submissions
     set status = new.decision::text::public.submission_status
   where submission_id = new.submission_id;

  update public.review_assignments
     set status = 'done'
   where submission_id = new.submission_id and reviewer_user_id = new.reviewer_user_id
     and status in ('pending', 'overdue');

  insert into public.notifications (recipient_user_id, submission_id, message)
  select s.created_by_user_id, s.submission_id,
         case new.decision
           when 'approved'          then 'Your submission was approved.'
           when 'rejected'          then 'Your submission was rejected.'
           when 'changes_requested' then 'Changes were requested on your submission.'
         end
    from public.submissions s where s.submission_id = new.submission_id;
  return null;
end $$;

create trigger approval_decisions_after_insert after insert on public.approval_decisions
  for each row execute function public.after_decision_insert();
