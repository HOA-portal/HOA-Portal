-- Migration 006: CRM integration & resident invite flow
-- Adds email + is_active to profiles, resident_invitations table,
-- crm_integrations table, and updates RLS helpers.

-- ============================================================
-- Extend profiles with email (for deduplication) and is_active
-- ============================================================
alter table profiles
  add column email      text,
  add column is_active  boolean not null default true;

create unique index profiles_hoa_email_unique_idx
  on profiles (hoa_id, lower(email))
  where email is not null;

create index profiles_hoa_active_idx
  on profiles (hoa_id, is_active);

-- Update helpers to exclude inactive profiles.
-- When is_active = false, my_hoa_id() returns NULL and all RLS policies
-- that check hoa_id = my_hoa_id() fail → user loses data access without
-- deleting their account.
create or replace function my_hoa_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select hoa_id from profiles where id = auth.uid() and is_active = true;
$$;

create or replace function my_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active = true;
$$;

-- Admins can manage (deactivate/reactivate) resident profiles in their HOA
create policy "Admins manage profiles in their HOA"
  on profiles for update
  using (hoa_id = my_hoa_id() and my_role() = 'admin')
  with check (hoa_id = my_hoa_id());

-- ============================================================
-- resident_invitations: shadow profiles before auth account exists
-- ============================================================
create table resident_invitations (
  id               uuid primary key default uuid_generate_v4(),
  hoa_id           uuid not null references hoas(id) on delete cascade,
  email            text not null,
  full_name        text,
  unit_number      text,
  phone            text,
  role             user_role not null default 'resident',
  invitation_token text not null unique default uuid_generate_v4()::text,
  invited_by       uuid not null references profiles(id),
  invited_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  external_id      text,
  external_source  text   -- 'csv', 'appfolio', 'yardi', 'manual'
);

alter table resident_invitations enable row level security;

create policy "Admins manage resident invitations"
  on resident_invitations for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

create index resident_invitations_token_idx
  on resident_invitations (invitation_token);

-- Expression index for case-insensitive email uniqueness per HOA.
-- emails are always stored lowercase, but the index guards against edge cases.
create unique index resident_invitations_hoa_email_idx
  on resident_invitations (hoa_id, lower(email));

-- ============================================================
-- get_invitation_by_token: SECURITY DEFINER for pre-login lookup
-- Called from the accept-invite page before the user has a session.
-- Only returns valid (non-expired, non-accepted) invitations.
-- ============================================================
create or replace function get_invitation_by_token(p_token text)
returns table (
  id             uuid,
  hoa_id         uuid,
  email          text,
  full_name      text,
  unit_number    text,
  phone          text,
  role           user_role,
  expires_at     timestamptz,
  hoa_name       text,
  hoa_subdomain  text
)
language sql
security definer
set search_path = public
as $$
  select
    i.id,
    i.hoa_id,
    i.email,
    i.full_name,
    i.unit_number,
    i.phone,
    i.role,
    i.expires_at,
    h.name  as hoa_name,
    h.subdomain as hoa_subdomain
  from resident_invitations i
  join hoas h on h.id = i.hoa_id
  where i.invitation_token = p_token
    and i.accepted_at is null
    and i.expires_at > now();
$$;

-- ============================================================
-- crm_integrations: API credentials per HOA per provider
-- ============================================================
create table crm_integrations (
  id             uuid primary key default uuid_generate_v4(),
  hoa_id         uuid not null references hoas(id) on delete cascade,
  provider       text not null,            -- 'appfolio', 'yardi', 'buildium', etc.
  credentials    jsonb not null default '{}',
  sync_config    jsonb not null default '{}',
  last_synced_at timestamptz,
  status         text not null default 'active' check (status in ('active', 'paused', 'error')),
  created_at     timestamptz not null default now(),
  unique (hoa_id, provider)
);

alter table crm_integrations enable row level security;

create policy "Admins manage CRM integrations"
  on crm_integrations for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');
