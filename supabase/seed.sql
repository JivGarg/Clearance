-- Clearance demo seed (DataBasePRD.md schema; demo brand from designPRD.md section 10).
-- CLEARLY FICTIONAL DEMO DATA. Two companies so tenant isolation can be seen and tested.
--
-- RUN ONCE on an empty database: `supabase db reset` (local) or paste into the SQL editor.
-- Needs a role that can write the auth schema (the default postgres role can).
-- Demo password for every user: clearance-demo   (frontend/src/lib/demo-users.ts matches).
--
-- Submissions are not inserted in their final state: they are driven through the real workflow
-- (revision -> in_review -> assignment -> decision), so the triggers in 0002 run on the seed too.

do $$
begin
  if exists (select 1 from public.organizations) then
    raise exception 'seed.sql expects an empty database (public.organizations is not empty)';
  end if;
end $$;

-- ---------------------------------------------------------------- companies

insert into public.organizations (organization_id, company_name) values
  ('0a000000-0000-4000-8000-000000000001', 'Sonic X Audio (demo)'),
  ('0a000000-0000-4000-8000-000000000002', 'Northwind Drinks (demo)');

-- ---------------------------------------------------------------- people
-- users.user_id equals the auth user id here for simplicity; the app links them via auth_user_id.

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
       crypt('clearance-demo', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', u.name),
       now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001', 'admin@sonicx.test',    'Aarav Mehta'),
  ('a0000000-0000-4000-8000-000000000002', 'manager@sonicx.test',  'Meera Kapoor'),
  ('a0000000-0000-4000-8000-000000000003', 'reviewer@sonicx.test', 'Rohan Iyer'),
  ('a0000000-0000-4000-8000-000000000004', 'creator@sonicx.test',  'Sana Qureshi'),
  ('a0000000-0000-4000-8000-000000000005', 'agency@sonicx.test',   'Tara D''Souza'),
  ('a0000000-0000-4000-8000-000000000006', 'admin@northwind.test', 'Lena Park'),
  ('a0000000-0000-4000-8000-000000000007', 'former@sonicx.test',   'Dev Malhotra')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%.test';

insert into public.users (user_id, name, email, auth_user_id)
select id, raw_user_meta_data ->> 'name', email, id from auth.users where email like '%.test';

insert into public.org_memberships (organization_id, user_id, role, status) values
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin',    'active'),
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'manager',  'active'),
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'reviewer', 'active'),
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'creator',  'active'),
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'creator',  'active'),
  ('0a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'reviewer', 'suspended'),
  ('0a000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'admin',    'active'),
  -- The agency works for both companies (DataBasePRD decision 3), as a creator in each.
  ('0a000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'creator',  'active');

-- ---------------------------------------------------------------- brand knowledge (Sonic X)

insert into public.brand_guidelines (guideline_id, organization_id, rule, category, version) values
  ('61000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Write the product name as "Sonic X1", never "SonicX 1" or "Sonic-X1".', 'terminology', 2),
  ('61000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001',
   'Paid or gifted content must carry #ad at the start of the caption.', 'disclosure', 1),
  ('61000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001',
   'No health or medical claims about listening, hearing or sleep.', 'claims', 1),
  ('61000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000001',
   'Images need alt text; videos need captions.', 'accessibility', 1),
  ('61000000-0000-4000-8000-000000000005', '0a000000-0000-4000-8000-000000000002',
   'Northwind is always written in one word.', 'terminology', 1),
  ('61000000-0000-4000-8000-000000000006', '0a000000-0000-4000-8000-000000000001',
   'Never call the product "cheap"; say "affordable".', 'terminology', 1),
  ('61000000-0000-4000-8000-000000000007', '0a000000-0000-4000-8000-000000000001',
   'Summer Sound posts use the hashtag #SummerSound.', 'campaign', 1),
  ('61000000-0000-4000-8000-000000000008', '0a000000-0000-4000-8000-000000000001',
   'Sound confident and clear, not hyped: no "OMG", "insane" or "you guys".', 'voice', 1);

insert into public.brand_assets (asset_id, organization_id, storage_path, asset_type, visibility) values
  ('62000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'assets/sonicx/logo-2026.svg',      'logo',  'public_to_creators'),
  ('62000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'assets/sonicx/logo-2022-old.svg',  'logo',  'internal'),
  ('62000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001', 'assets/sonicx/nova-render.png',    'image', 'confidential'),
  ('62000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000002', 'assets/northwind/logo.svg',        'logo',  'public_to_creators');

insert into public.approved_facts (fact_id, organization_id, fact, source, valid_until, confidentiality_level) values
  ('f1000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Sonic X1 battery life is 50 hours.', 'Spec sheet v3', null, 'public_to_creators'),
  ('f1000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001',
   'Student discount is 20%.', 'Campus Beats brief', now() + interval '120 days', 'internal'),
  ('f1000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001',
   'Nova launch price is USD 249.', 'Pricing committee', now() + interval '60 days', 'confidential'),
  ('f1000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000001',
   'Spring promo code is SPRING15.', 'Spring campaign brief', now() - interval '30 days', 'public_to_creators'),
  ('f1000000-0000-4000-8000-000000000005', '0a000000-0000-4000-8000-000000000002',
   'Northwind Calm costs USD 2.49.', 'Price list', null, 'internal');

insert into public.embargoes (embargo_id, organization_id, restricted_item, release_at, visibility) values
  ('f2000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Project Nova (unreleased headphones)', now() + interval '25 days', 'confidential'),
  ('f2000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001',
   'Sonic X1 Pro colourways', now() - interval '3 days', 'internal');   -- already released

insert into public.campaigns (campaign_id, organization_id, campaign_name, start_date, end_date) values
  ('c0000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'Summer Sound', current_date - 10, current_date + 50),
  ('c0000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'Campus Beats', current_date - 5,  current_date + 80),
  ('c0000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000002', 'Calm Launch',  current_date,      current_date + 30);

-- ---------------------------------------------------------------- submissions, through the workflow
-- Sana (a..04) is an in-house creator, Tara (a..05) an agency creator (same access), Rohan (a..03) the reviewer.
-- Each submission ends in a different status; together they cover all six.

insert into public.submissions
  (submission_id, organization_id, campaign_id, created_by_user_id, content_path, type, channel, intent_summary) values
  ('50000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'submissions/s1/draft.txt', 'text',  'instagram', 'Tease the summer range to existing followers.'),
  ('50000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'submissions/s2/draft.mp4', 'video', 'youtube',   'Show the X1 lasting a full festival weekend.'),
  ('50000000-0000-4000-8000-000000000003', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000005', 'submissions/s3/draft.txt', 'text',  'instagram', 'Promote the student offer to campus followers.'),
  ('50000000-0000-4000-8000-000000000004', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'submissions/s4/draft.txt', 'text',  'blog',      'Explain how to care for the X1.'),
  ('50000000-0000-4000-8000-000000000005', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000005', 'submissions/s5/draft.png', 'image', 'instagram', 'Sell the X1 as a sleep aid.'),
  ('50000000-0000-4000-8000-000000000006', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'submissions/s6/draft.txt', 'text',  'linkedin',  'Announce the summer partner programme.'),
  ('50000000-0000-4000-8000-000000000007', '0a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000004', 'submissions/s7/draft.txt', 'text',  'instagram', 'Build hype for what is next.'),
  ('50000000-0000-4000-8000-000000000008', '0a000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000005', 'submissions/s8/draft.txt', 'text',  'instagram', 'Northwind Calm launch post.');

-- Version 1 of each (numbering is automatic). #2 also gets a version 2.
insert into public.revisions (submission_id, edited_by_user_id, content_path, change_summary)
select s.submission_id, s.created_by_user_id, replace(s.content_path, 'draft', 'v1'), 'First version'
  from public.submissions s order by s.submission_id;
insert into public.revisions (submission_id, edited_by_user_id, content_path, change_summary) values
  ('50000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004',
   'submissions/s2/v2.mp4', 'Recut intro, product name fixed');

-- Everything except the two drafts goes to review, with Rohan assigned.
update public.submissions set status = 'in_review'
 where submission_id not in ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000008');

insert into public.review_assignments (submission_id, reviewer_user_id, deadline, status)
select submission_id, 'a0000000-0000-4000-8000-000000000003', now() + interval '1 day', 'pending'
  from public.submissions where status = 'in_review';

-- ---------------------------------------------------------------- AI checks (MOCK, labelled as such)

insert into public.ai_checks (check_id, submission_id, revision_id, risk_level, service_used, result)
select x.cid::uuid, x.sid::uuid, public.latest_revision_id(x.sid::uuid), x.risk::public.risk_level,
       'mock-rules-v1', jsonb_build_object('mock', true, 'summary', x.summary)
from (values
  ('cc000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'high',   'Battery claim does not match approved fact'),
  ('cc000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 'medium', 'Ad disclosure missing'),
  ('cc000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000004', 'low',    'Alt text missing on one image'),
  ('cc000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', 'high',   'Health claim'),
  ('cc000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000006', 'low',    'No issues found'),
  ('cc000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000007', 'high',   'Mentions an embargoed product')
) as x(cid, sid, risk, summary);

insert into public.issues (issue_id, check_id, issue_type, explanation, source_type, source_id, risk_level, suggested_fix) values
  ('e0000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000002', 'Incorrect fact',
   'The video says "60 hours of battery". The approved figure is 50 hours.',
   'fact', 'f1000000-0000-4000-8000-000000000001', 'high', 'Say "up to 50 hours of battery".'),
  ('e0000000-0000-4000-8000-000000000002', 'cc000000-0000-4000-8000-000000000002', 'Terminology',
   '"SonicX 1" is not the approved product name.',
   'guideline', '61000000-0000-4000-8000-000000000001', 'low', 'Sonic X1'),
  ('e0000000-0000-4000-8000-000000000003', 'cc000000-0000-4000-8000-000000000003', 'Missing ad disclosure',
   'The post promotes a discount code but has no #ad label.',
   'guideline', '61000000-0000-4000-8000-000000000002', 'medium', 'Start the caption with #ad.'),
  ('e0000000-0000-4000-8000-000000000004', 'cc000000-0000-4000-8000-000000000004', 'Accessibility',
   'One image has no alt text.',
   'guideline', '61000000-0000-4000-8000-000000000004', 'low', 'Add a short description of the image.'),
  ('e0000000-0000-4000-8000-000000000005', 'cc000000-0000-4000-8000-000000000005', 'Health claim',
   'Saying the X1 helps you fall asleep faster is a health claim, which is not allowed.',
   'guideline', '61000000-0000-4000-8000-000000000003', 'high', 'Remove the sleep claim.'),
  ('e0000000-0000-4000-8000-000000000006', 'cc000000-0000-4000-8000-000000000007', 'Embargoed item',
   'The caption names Project Nova, which is under embargo.',
   'embargo', 'f2000000-0000-4000-8000-000000000001', 'high', null);

insert into public.agent_action_log (submission_id, action, reason, undo_data) values
  ('50000000-0000-4000-8000-000000000002', 'run_check',        'New revision uploaded', null),
  ('50000000-0000-4000-8000-000000000002', 'auto_fix_applied', 'Low-risk terminology fix: SonicX 1 to Sonic X1',
   '{"field":"caption","before":"SonicX 1","after":"Sonic X1"}'),
  ('50000000-0000-4000-8000-000000000007', 'hold',             'Embargoed item found; routed to authorised reviewer', null);

-- ---------------------------------------------------------------- decisions (drive final statuses)
-- Signed in as nobody, so these run as the system; the decision triggers still apply every rule.

insert into public.approval_decisions (submission_id, revision_id, reviewer_user_id, decision, comments)
select x.sid::uuid, public.latest_revision_id(x.sid::uuid), 'a0000000-0000-4000-8000-000000000003',
       x.decision::public.decision_kind, x.comments
from (values
  ('50000000-0000-4000-8000-000000000003', 'changes_requested', 'Add #ad at the start of the caption.'),
  ('50000000-0000-4000-8000-000000000004', 'approved',          null),
  ('50000000-0000-4000-8000-000000000005', 'rejected',          'Health claims cannot be used.'),
  ('50000000-0000-4000-8000-000000000006', 'approved',          'Clear to go.')
) as x(sid, decision, comments);

update public.submissions set status = 'released' where submission_id = '50000000-0000-4000-8000-000000000006';

insert into public.notifications (recipient_user_id, submission_id, message) values
  ('a0000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 'You have a review due tomorrow.'),
  ('a0000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000007', 'Embargo hold needs your review.'),
  ('a0000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000007', 'A submission is on embargo hold.');
