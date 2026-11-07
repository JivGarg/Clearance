-- Minimal stand-in for the Supabase pieces our migrations depend on, so the SQL can be
-- exercised on a plain local Postgres (see run_local.py). NOT for use on Supabase itself,
-- where the auth schema, these roles and auth.uid() already exist.

create schema if not exists auth;

create table if not exists auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz,
  confirmation_token text, email_change text, email_change_token_new text, recovery_token text
);

create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz
);

-- Same lookup order as Supabase: claim.sub first, then the claims JSON.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema auth   to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- seed.sql hashes the demo password with pgcrypto's crypt()/gen_salt(), which Supabase provides.
-- Some local Postgres builds ship without contrib; then fall back to stand-ins so the rest of the
-- seed can still run. The stand-ins do NOT hash: this only exercises the SQL flow, not GoTrue login.
do $$
begin
  create extension if not exists pgcrypto;
exception when others then
  raise notice 'pgcrypto unavailable: using non-hashing stand-ins for crypt() and gen_salt()';
  execute 'create function public.crypt(text, text) returns text language sql immutable as $f$ select ''stub:'' || $1 $f$';
  execute 'create function public.gen_salt(text) returns text language sql immutable as $f$ select ''salt'' $f$';
end $$;
