-- Behavioural tests for DataBasePRD.md: access matrix (4), integrity rules (7), isolation (9).
-- Runs after the migrations and seed.sql, in one transaction that is rolled back at the end.
-- A failed expectation raises and aborts the run. Sections are split on "-- ====" lines by
-- run_local.py so every PASS line is captured.

begin;

create schema zz_test;
grant usage on schema zz_test to public;

-- Seeded users: 1 admin, 2 manager, 3 reviewer, 4 creator (company scope), 5 agency creator
-- (own_work in Sonic X, company in Northwind), 6 Northwind admin, 7 suspended reviewer.
create function zz_test.u(n int) returns uuid language sql immutable as $$
  select ('a0000000-0000-4000-8000-00000000000' || n)::uuid $$;
create function zz_test.s(n int) returns uuid language sql immutable as $$
  select ('50000000-0000-4000-8000-00000000000' || n)::uuid $$;
create function zz_test.org(n int) returns uuid language sql immutable as $$
  select ('0a000000-0000-4000-8000-00000000000' || n)::uuid $$;

create function zz_test.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  set local role authenticated;
end $$;
create function zz_test.as_system() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
create function zz_test.expect(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_name; end if;
  raise notice 'PASS: %', p_name;
end $$;
create function zz_test.fails(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql; return null;
exception when others then return sqlerrm;
end $$;
create function zz_test.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute p_sql into v; return v; end $$;
create function zz_test.affected(p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin execute p_sql; get diagnostics v = row_count; return v; end $$;

-- ================================================================ seed sanity

select zz_test.expect('seed: all six statuses are present',
  zz_test.n('select count(distinct status) from submissions') = 6);
select zz_test.expect('seed: decisions closed their assignments',
  zz_test.n($$select count(*) from review_assignments where status = 'done'$$) = 4);

-- ================================================================ isolation and visibility (matrix)

select zz_test.as_user(zz_test.u(1));  -- Sonic X admin
select zz_test.expect('admin: sees every Sonic X submission', zz_test.n('select count(*) from submissions') = 7);
select zz_test.expect('admin: sees nothing from the other company',
  zz_test.n($$select count(*) from submissions where organization_id = zz_test.org(2)$$) = 0
  and zz_test.n($$select count(*) from organizations$$) = 1
  and zz_test.n($$select count(*) from brand_guidelines where organization_id = zz_test.org(2)$$) = 0);
select zz_test.expect('admin: a guessed submission id from the other company returns nothing',
  zz_test.n($$select count(*) from submissions where submission_id = zz_test.s(8)$$) = 0);
select zz_test.expect('admin: sees the agent action log', zz_test.n('select count(*) from agent_action_log') = 3);

select zz_test.as_user(zz_test.u(6));  -- Northwind admin
select zz_test.expect('other company admin: sees only her company',
  zz_test.n('select count(*) from submissions') = 1
  and zz_test.n('select count(*) from approved_facts') = 1
  and zz_test.n('select count(*) from embargoes') = 0
  and zz_test.n('select count(*) from issues') = 0);

select zz_test.as_user(zz_test.u(2));  -- manager
select zz_test.expect('manager: sees all company submissions and memberships',
  zz_test.n('select count(*) from submissions') = 7
  and zz_test.n('select count(*) from org_memberships') = 6);
select zz_test.expect('manager: current_facts hides expired facts',
  zz_test.n('select count(*) from current_facts') = 3 and zz_test.n('select count(*) from approved_facts') = 4);
select zz_test.expect('manager: active_embargoes hides released ones',
  zz_test.n('select count(*) from active_embargoes') = 1 and zz_test.n('select count(*) from embargoes') = 2);

select zz_test.as_user(zz_test.u(3));  -- reviewer
select zz_test.expect('reviewer: sees only assigned submissions',
  zz_test.n('select count(*) from submissions') = 6
  and zz_test.n($$select count(*) from submissions where submission_id = zz_test.s(1)$$) = 0);
select zz_test.expect('reviewer: sees own assignments only', zz_test.n('select count(*) from review_assignments') = 6);
select zz_test.expect('reviewer: no agent action log', zz_test.n('select count(*) from agent_action_log') = 0);
select zz_test.expect('reviewer: reads all knowledge incl. confidential',
  zz_test.n('select count(*) from approved_facts') = 4 and zz_test.n('select count(*) from embargoes') = 2);
select zz_test.expect('reviewer: no memberships except her own',
  zz_test.n('select count(*) from org_memberships') = 1);

select zz_test.as_user(zz_test.u(4));  -- creator, company scope
select zz_test.expect('company creator: sees only her own submissions', zz_test.n('select count(*) from submissions') = 5);
select zz_test.expect('company creator: public + internal facts, never confidential',
  zz_test.n('select count(*) from approved_facts') = 3
  and zz_test.n($$select count(*) from approved_facts where confidentiality_level = 'confidential'$$) = 0);
select zz_test.expect('company creator: sees internal embargo, not the confidential codename',
  zz_test.n('select count(*) from embargoes') = 1
  and zz_test.n($$select count(*) from embargoes where restricted_item like 'Project Nova%'$$) = 0);
select zz_test.expect('company creator: embargo finding is hidden, but counted as restricted',
  zz_test.n($$select count(*) from issues i join ai_checks c on c.check_id = i.check_id where c.submission_id = zz_test.s(7)$$) = 0
  and zz_test.n($$select restricted_issue_count(zz_test.s(7))$$) = 1);
select zz_test.expect('company creator: sees findings she is allowed to read (3)', zz_test.n('select count(*) from issues') = 3);
select zz_test.expect('company creator: no agent log, no assignments',
  zz_test.n('select count(*) from agent_action_log') = 0 and zz_test.n('select count(*) from review_assignments') = 0);
select zz_test.expect('company creator: cannot see other creators',
  zz_test.n($$select count(*) from users where user_id = zz_test.u(5)$$) = 0
  and zz_test.n($$select count(*) from users where user_id = zz_test.u(3)$$) = 1);

select zz_test.as_user(zz_test.u(5));  -- agency: own_work in Sonic X, company in Northwind
select zz_test.expect('agency: sees only her own work, across both companies',
  zz_test.n('select count(*) from submissions') = 3);
select zz_test.expect('agency (own_work): only public-to-creators knowledge in Sonic X',
  zz_test.n($$select count(*) from approved_facts where organization_id = zz_test.org(1)$$) = 2
  and zz_test.n($$select count(*) from embargoes where organization_id = zz_test.org(1)$$) = 0
  and zz_test.n($$select count(*) from brand_assets where organization_id = zz_test.org(1)$$) = 1);
select zz_test.expect('agency (company scope elsewhere): internal facts in Northwind',
  zz_test.n($$select count(*) from approved_facts where organization_id = zz_test.org(2)$$) = 1);
select zz_test.expect('agency: decisions and notifications on her own work only',
  zz_test.n('select count(*) from approval_decisions') = 2 and zz_test.n('select count(*) from notifications') = 2);

select zz_test.as_user(zz_test.u(7));  -- suspended reviewer
select zz_test.expect('suspended member: sees nothing',
  zz_test.n('select count(*) from submissions') = 0 and zz_test.n('select count(*) from organizations') = 0
  and zz_test.n('select count(*) from brand_guidelines') = 0);

select zz_test.as_system();
set local role anon;
select zz_test.expect('anonymous: no access at all',
  zz_test.fails('select * from public.submissions') ilike '%permission denied%'
  and zz_test.fails('select * from public.approved_facts') ilike '%permission denied%');
select zz_test.as_system();

-- ================================================================ integrity rules (section 7)

select zz_test.expect('rule 5: approval decisions cannot be edited',
  zz_test.fails($$update approval_decisions set comments = 'x'$$) ilike '%append-only%');
select zz_test.expect('rule 5: revisions cannot be deleted',
  zz_test.fails($$delete from revisions$$) ilike '%append-only%');
select zz_test.expect('rule 5: agent log cannot be edited, even by the system',
  zz_test.fails($$update agent_action_log set reason = 'x'$$) ilike '%append-only%');
select zz_test.expect('rule 6: submissions cannot be deleted, even by the system',
  zz_test.fails($$delete from submissions where submission_id = zz_test.s(1)$$) ilike '%cannot be deleted%');
select zz_test.expect('rule 6: issues cannot be deleted',
  zz_test.fails($$delete from issues$$) ilike '%cannot be deleted%');
select zz_test.expect('rule 6: a company with submissions cannot be deleted',
  zz_test.fails($$delete from organizations where organization_id = zz_test.org(1)$$) is not null);
select zz_test.expect('rule 1: a submission cannot use another company''s campaign',
  zz_test.fails($$insert into submissions (organization_id, campaign_id, created_by_user_id, content_path, type, channel)
                  values (zz_test.org(1), 'c0000000-0000-4000-8000-000000000003', zz_test.u(4), 'x', 'text', 'blog')$$)
    ilike '%foreign key%');
select zz_test.expect('rule 1: an issue cannot cite another company''s guideline',
  zz_test.fails($$insert into issues (check_id, issue_type, explanation, source_type, source_id, risk_level)
                  values ('cc000000-0000-4000-8000-000000000002', 't', 'because', 'guideline',
                          '61000000-0000-4000-8000-000000000005', 'low')$$) ilike '%not found in this company%');
select zz_test.expect('rule 3: a suspended reviewer cannot be assigned',
  zz_test.fails($$insert into review_assignments (submission_id, reviewer_user_id) values (zz_test.s(7), zz_test.u(7))$$)
    ilike '%active reviewer%');
select zz_test.expect('rule 3: a creator cannot be assigned as reviewer',
  zz_test.fails($$insert into review_assignments (submission_id, reviewer_user_id) values (zz_test.s(7), zz_test.u(4))$$)
    ilike '%active reviewer%');
select zz_test.expect('every finding must explain itself',
  zz_test.fails($$insert into issues (check_id, issue_type, explanation, source_type, source_id, risk_level)
                  values ('cc000000-0000-4000-8000-000000000002', 't', ' ', 'guideline',
                          '61000000-0000-4000-8000-000000000001', 'low')$$) ilike '%check constraint%');

-- Rule 4 scaffolding: a submission authored by the reviewer (only the system could create it).
insert into submissions (submission_id, organization_id, created_by_user_id, content_path, type, channel)
values ('50000000-0000-4000-8000-0000000000ff', zz_test.org(1), zz_test.u(3), 'x', 'text', 'blog');
insert into revisions (submission_id, edited_by_user_id, content_path) values ('50000000-0000-4000-8000-0000000000ff', zz_test.u(3), 'x1');
update submissions set status = 'in_review' where submission_id = '50000000-0000-4000-8000-0000000000ff';
insert into review_assignments (submission_id, reviewer_user_id) values ('50000000-0000-4000-8000-0000000000ff', zz_test.u(3));

select zz_test.as_user(zz_test.u(3));
select zz_test.expect('rule 4: a reviewer cannot decide on their own submission',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values ('50000000-0000-4000-8000-0000000000ff',
                          latest_revision_id('50000000-0000-4000-8000-0000000000ff'), zz_test.u(3), 'approved')$$)
    ilike '%their own submission%');

-- ================================================================ review decisions

select zz_test.expect('decision: must be on the latest revision',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  select zz_test.s(2), revision_id, zz_test.u(3), 'approved'
                    from revisions where submission_id = zz_test.s(2) and version = 1$$) ilike '%latest revision%');
select zz_test.expect('decision: cannot approve while an embargo is active',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values (zz_test.s(7), latest_revision_id(zz_test.s(7)), zz_test.u(3), 'approved')$$)
    ilike '%active embargo%');
select zz_test.expect('decision: rejecting needs a reason',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values (zz_test.s(7), latest_revision_id(zz_test.s(7)), zz_test.u(3), 'rejected')$$)
    ilike '%check constraint%');
select zz_test.expect('decision: cannot decide in someone else''s name',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values (zz_test.s(2), latest_revision_id(zz_test.s(2)), zz_test.u(1), 'approved')$$)
    similar to '%(row-level security|active reviewer)%');  -- trigger or policy, whichever fires first
select zz_test.expect('decision: reviewer cannot change status directly',
  zz_test.fails($$update submissions set status = 'approved' where submission_id = zz_test.s(2)$$) is not null);
select zz_test.expect('decision: reviewer approves the latest revision of #2',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values (zz_test.s(2), latest_revision_id(zz_test.s(2)), zz_test.u(3), 'approved')$$) is null);
select zz_test.expect('decision: status became approved and the assignment closed',
  zz_test.n($$select count(*) from submissions where submission_id = zz_test.s(2) and status = 'approved'$$) = 1
  and zz_test.n($$select count(*) from review_assignments where submission_id = zz_test.s(2) and status = 'done'$$) = 1);
select zz_test.expect('decision: no second decision on a decided submission',
  zz_test.fails($$insert into approval_decisions (submission_id, revision_id, reviewer_user_id, decision)
                  values (zz_test.s(2), latest_revision_id(zz_test.s(2)), zz_test.u(3), 'approved')$$)
    ilike '%only submissions in review%');

select zz_test.as_user(zz_test.u(4));
select zz_test.expect('decision: the creator was notified',
  zz_test.n($$select count(*) from notifications where submission_id = zz_test.s(2) and message like '%approved%'$$) = 1);
select zz_test.expect('stale approval: a new revision sends approved content back to review',
  zz_test.fails($$insert into revisions (submission_id, edited_by_user_id, content_path) values (zz_test.s(2), zz_test.u(4), 'v3')$$) is null
  and zz_test.n($$select count(*) from submissions where submission_id = zz_test.s(2) and status = 'in_review'$$) = 1);

-- ================================================================ creator and staff limits

select zz_test.expect('creator cannot approve her own work',
  zz_test.fails($$update submissions set status = 'approved' where submission_id = zz_test.s(1)$$) ilike '%illegal status%');
select zz_test.expect('creator sends a draft to review',
  zz_test.fails($$update submissions set status = 'in_review' where submission_id = zz_test.s(1)$$) is null);
select zz_test.expect('creator cannot edit content in place after the draft stage',
  zz_test.fails($$update submissions set content_path = 'sneaky' where submission_id = zz_test.s(4)$$) ilike '%adding a revision%');
select zz_test.expect('creator cannot create a submission in a company she is not in',
  zz_test.fails($$insert into submissions (organization_id, created_by_user_id, content_path, type, channel)
                  values (zz_test.org(2), zz_test.u(4), 'x', 'text', 'blog')$$) ilike '%row-level security%');
select zz_test.expect('creator can create a draft in her company',
  zz_test.fails($$insert into submissions (organization_id, created_by_user_id, content_path, type, channel)
                  values (zz_test.org(1), zz_test.u(4), 'x', 'text', 'blog')$$) is null);
select zz_test.expect('creator cannot add revisions to someone else''s submission',
  zz_test.fails($$insert into revisions (submission_id, edited_by_user_id, content_path) values (zz_test.s(3), zz_test.u(4), 'x')$$)
    ilike '%row-level security%');
select zz_test.expect('creator can rename herself but not change her email',
  zz_test.affected($$update users set name = 'Sana Q.' where user_id = zz_test.u(4)$$) = 1
  and zz_test.fails($$update users set email = 'x@y.test' where user_id = zz_test.u(4)$$) ilike '%permission denied%');
select zz_test.expect('notifications: mark read, but not rewrite',
  zz_test.affected($$update notifications set read_at = now() where recipient_user_id = zz_test.u(4)$$) >= 1
  and zz_test.fails($$update notifications set message = 'x'$$) ilike '%permission denied%');

select zz_test.as_user(zz_test.u(5));
select zz_test.expect('agency cannot resubmit without a new revision',
  zz_test.fails($$update submissions set status = 'in_review' where submission_id = zz_test.s(3)$$) ilike '%new revision%');
select zz_test.expect('agency resubmits after adding a revision',
  zz_test.fails($$insert into revisions (submission_id, edited_by_user_id, content_path) values (zz_test.s(3), zz_test.u(5), 'v2')$$) is null
  and zz_test.fails($$update submissions set status = 'in_review' where submission_id = zz_test.s(3)$$) is null);

select zz_test.as_user(zz_test.u(2));
select zz_test.expect('manager cannot approve content',
  -- #3 is in review with no embargo, so only the role rule can stop this
  zz_test.fails($$update submissions set status = 'approved' where submission_id = zz_test.s(3)$$) ilike '%only release%');
select zz_test.expect('manager cannot create submissions',
  zz_test.fails($$insert into submissions (organization_id, created_by_user_id, content_path, type, channel)
                  values (zz_test.org(1), zz_test.u(2), 'x', 'text', 'blog')$$) ilike '%row-level security%');
select zz_test.expect('manager cannot edit memberships',
  zz_test.affected($$update org_memberships set role = 'admin' where user_id = zz_test.u(2)$$) = 0);
select zz_test.expect('manager releases approved content',
  zz_test.fails($$update submissions set status = 'released' where submission_id = zz_test.s(4)$$) is null);
select zz_test.expect('manager assigns an eligible reviewer',
  zz_test.fails($$insert into review_assignments (submission_id, reviewer_user_id) values (zz_test.s(1), zz_test.u(3))$$) is null);

select zz_test.as_user(zz_test.u(1));
select zz_test.expect('admin cannot assign reviewers (matrix: view only)',
  zz_test.fails($$insert into review_assignments (submission_id, reviewer_user_id) values (zz_test.s(1), zz_test.u(3))$$)
    ilike '%row-level security%');
select zz_test.expect('admin can suspend a member',
  zz_test.affected($$update org_memberships set status = 'suspended' where user_id = zz_test.u(5) and organization_id = zz_test.org(1)$$) = 1);
select zz_test.expect('admin cannot touch another company''s memberships',
  zz_test.affected($$update org_memberships set status = 'suspended' where organization_id = zz_test.org(2)$$) = 0);

rollback;
