-- Demo seed for /demo route — local dev only
-- Run: psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_demo.sql
-- The auth.users direct insert only works with local Supabase.
-- For production, use /api/demo/setup?secret=<DEMO_SETUP_SECRET> instead.

-- ============================================================
-- 1. Demo HOA
-- ============================================================
insert into public.hoas (id, name, subdomain, city, state)
values (
  '00000000-0000-0000-0000-000000000001',
  'Sunset Ridge HOA',
  'sunset-ridge-demo',
  'Orlando',
  'FL'
)
on conflict (id) do nothing;

-- ============================================================
-- 2. Demo Admin auth user
-- Password: 'demo-password' — must match DEMO_USER_PASSWORD in .env.local
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'demo@hoa-portal.app',
  crypt('demo-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  false, '', ''
)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"demo@hoa-portal.app"}',
  'email', now(), now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, hoa_id, role, full_name, email, is_active)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin', 'Demo Admin', 'demo@hoa-portal.app', true
)
on conflict (id) do update set role = 'admin', full_name = 'Demo Admin', unit_number = null;

-- ============================================================
-- 3. Demo Resident users (data anchors for seed records)
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-res1@hoa-portal.app', crypt('placeholder-9x!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', ''),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-res2@hoa-portal.app', crypt('placeholder-9x!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', ''),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-res3@hoa-portal.app', crypt('placeholder-9x!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', false, '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '{"sub":"00000000-0000-0000-0000-000000000003","email":"demo-res1@hoa-portal.app"}', 'email', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '{"sub":"00000000-0000-0000-0000-000000000004","email":"demo-res2@hoa-portal.app"}', 'email', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', '{"sub":"00000000-0000-0000-0000-000000000005","email":"demo-res3@hoa-portal.app"}', 'email', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, hoa_id, role, full_name, unit_number, email, is_active)
values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'resident', 'Maria Santos',  '204', 'demo-res1@hoa-portal.app', true),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'resident', 'James Carter',  '312', 'demo-res2@hoa-portal.app', true),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'resident', 'Linda Park',    '108', 'demo-res3@hoa-portal.app', true)
on conflict (id) do nothing;

-- ============================================================
-- 4. Amenity
-- ============================================================
insert into public.amenities (id, hoa_id, name, description, capacity, rules, is_active)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Community Clubhouse',
  'Main gathering space with kitchen and event area. Seats up to 50 guests.',
  50,
  'Must be vacated by 10pm. No outside catering without prior approval.',
  true
)
on conflict (id) do nothing;

-- ============================================================
-- 5. Work Orders
-- ============================================================
insert into public.work_orders (id, hoa_id, submitted_by, title, description, status, priority, admin_notes)
values
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
    'Pool pump making unusual noise',
    'The main pool pump has been making a loud grinding noise since Monday morning. It seems to be running but the sound is concerning — may need inspection.',
    'open', 'high', null
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
    'Parking lot lights out — spots 12–15',
    'Three overhead lights in the east parking section have been out for over a week. Residents are having difficulty navigating at night.',
    'in_progress', 'medium', 'Electrician scheduled for Thursday. Replacement parts already ordered.'
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005',
    'Broken gate latch on east entrance',
    'The security gate latch on the east entrance is broken and the gate swings open freely. This is a safety concern for the community.',
    'open', 'urgent', null
  ),
  (
    '00000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
    'Lobby carpet stain near elevator',
    'There is a large stain on the lobby carpet near the elevator doors. Reported 3 weeks ago — following up on status.',
    'resolved', 'low', 'Professional carpet cleaning completed on June 8th. Stain fully removed.'
  )
on conflict (id) do nothing;

-- ============================================================
-- 6. Complaints
-- ============================================================
insert into public.complaints (id, hoa_id, submitted_by, subject, description, category, status, admin_notes)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
    'Loud music after 11pm — Unit 307',
    'Unit 307 has been playing loud music past 11pm on weekdays for two weeks. Multiple residents have been disturbed. This is a repeated violation of quiet hours.',
    'noise', 'under_review', 'First written notice sent to resident of Unit 307 on June 10th. Monitoring for further incidents.'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
    'Dog waste not being picked up near pool area',
    'Dog waste is regularly being left near the pool deck and on the main walking path. This is a hygiene issue for all residents and their families.',
    'property', 'open', null
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005',
    'Resident blocking reserved parking spot 22',
    'An unregistered vehicle has been blocking my assigned reserved parking spot (Spot 22) on multiple occasions over the last two weeks.',
    'parking', 'resolved', 'Vehicle owner identified and issued formal warning. No further incidents reported.'
  )
on conflict (id) do nothing;

-- ============================================================
-- 7. Violations
-- ============================================================
insert into public.violations (id, hoa_id, reported_by, resident_unit, description, rule_reference, status, fine_amount, formal_notice, issued_at)
values
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '204',
    'Unauthorized vehicle parked in designated guest-only zone for 5+ consecutive days.',
    'CC&R Section 4.3 — Parking Rules',
    'issued', 75.00,
    'This notice is to inform you that a vehicle registered to your unit has been parked in the guest-only zone in violation of CC&R Section 4.3. A fine of $75.00 has been assessed. Please ensure the vehicle is relocated immediately to avoid additional fines of $25/day.',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '312',
    'Unapproved satellite dish installed on exterior balcony railing without architectural committee approval.',
    'CC&R Section 7.1 — Architectural Modifications',
    'draft', 150.00, null, null
  ),
  (
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '108',
    'Holiday decorations left in place past the February 1st community deadline.',
    'CC&R Section 5.2 — Exterior Decorations',
    'issued', 50.00,
    'Your exterior holiday decorations remained in place past the February 1st deadline established by CC&R Section 5.2. A fine of $50.00 has been assessed. Please remove all decorations within 5 business days to avoid further action.',
    now()
  )
on conflict (id) do nothing;

-- ============================================================
-- 8. Announcement
-- ============================================================
insert into public.announcements (id, hoa_id, created_by, subject, body, status, send_email, send_sms, published_at)
values (
  '00000000-0000-0000-0000-000000000050',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Annual HOA Meeting — Save the Date',
  E'Dear Sunset Ridge Residents,\n\nPlease join us for our Annual HOA Meeting on Saturday, July 12th at 10:00 AM in the Community Clubhouse.\n\nAgenda items include:\n• 2024–2025 budget review and approval\n• Upcoming landscaping improvements (east courtyard)\n• Pool area renovation proposal\n• Election of one board member\n\nLight refreshments will be provided. Please RSVP to the management office by July 8th.\n\nWe look forward to seeing you there!\n\nThe Sunset Ridge HOA Board',
  'published', true, false, now()
)
on conflict (id) do nothing;
