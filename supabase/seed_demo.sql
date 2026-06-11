-- Demo seed for /demo route — local dev only
-- Run: psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_demo.sql
-- The auth.users direct insert only works with local Supabase.
-- For production, create the demo user via supabase.auth.admin.createUser() once.

-- 1. Demo HOA
insert into public.hoas (id, name, subdomain, city, state)
values (
  '00000000-0000-0000-0000-000000000001',
  'Sunset Ridge HOA',
  'sunset-ridge-demo',
  'Orlando',
  'FL'
)
on conflict (id) do nothing;

-- 2. Demo auth user
-- Password hardcoded as 'demo-password' here; DEMO_USER_PASSWORD in .env.local must match.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@hoa-portal.app',
  crypt('demo-password', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  '',
  ''
)
on conflict (id) do nothing;

-- 3. auth.identities row — required for email sign-in in Supabase >= 2.x
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"demo@hoa-portal.app"}',
  'email',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

-- 4. Demo profile
insert into public.profiles (id, hoa_id, role, full_name, unit_number, email, is_active)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'resident',
  'Demo Resident',
  '101',
  'demo@hoa-portal.app',
  true
)
on conflict (id) do nothing;
