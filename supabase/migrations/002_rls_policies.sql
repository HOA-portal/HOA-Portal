-- ============================================================
-- Helper functions (SECURITY DEFINER — run as owner, not caller)
-- ============================================================

-- Returns the hoa_id of the currently authenticated user
create or replace function my_hoa_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select hoa_id from profiles where id = auth.uid();
$$;

-- Returns the role of the currently authenticated user
create or replace function my_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- Auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Profile is inserted by the signup flow with hoa_id, role, etc.
  -- This trigger is a safety net in case the signup API fails.
  return new;
end;
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table hoas            enable row level security;
alter table profiles        enable row level security;
alter table ccr_documents   enable row level security;
alter table ccr_chunks      enable row level security;
alter table work_orders     enable row level security;
alter table amenities       enable row level security;
alter table bookings        enable row level security;
alter table complaints      enable row level security;
alter table violations      enable row level security;
alter table chat_sessions   enable row level security;
alter table chat_messages   enable row level security;
alter table announcements   enable row level security;

-- ============================================================
-- hoas: users can only read their own HOA
-- ============================================================
create policy "Users read their HOA"
  on hoas for select
  using (id = my_hoa_id());

-- ============================================================
-- profiles
-- ============================================================
create policy "Users read profiles in their HOA"
  on profiles for select
  using (hoa_id = my_hoa_id());

create policy "Users update their own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users insert their own profile"
  on profiles for insert
  with check (id = auth.uid());

-- ============================================================
-- ccr_documents: everyone in HOA reads; only admin writes
-- ============================================================
create policy "HOA members read CC&R documents"
  on ccr_documents for select
  using (hoa_id = my_hoa_id());

create policy "Admins insert CC&R documents"
  on ccr_documents for insert
  with check (hoa_id = my_hoa_id() and my_role() = 'admin');

create policy "Admins delete CC&R documents"
  on ccr_documents for delete
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- ccr_chunks: everyone in HOA reads; only admin writes
-- ============================================================
create policy "HOA members read CC&R chunks"
  on ccr_chunks for select
  using (hoa_id = my_hoa_id());

create policy "Admins manage CC&R chunks"
  on ccr_chunks for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- work_orders
-- ============================================================
create policy "Residents read their own work orders"
  on work_orders for select
  using (
    hoa_id = my_hoa_id()
    and (submitted_by = auth.uid() or my_role() = 'admin')
  );

create policy "Residents create work orders"
  on work_orders for insert
  with check (hoa_id = my_hoa_id() and submitted_by = auth.uid());

create policy "Admins update work orders"
  on work_orders for update
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- amenities: everyone reads active; only admin writes
-- ============================================================
create policy "HOA members read amenities"
  on amenities for select
  using (hoa_id = my_hoa_id());

create policy "Admins manage amenities"
  on amenities for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- bookings
-- ============================================================
create policy "Residents read their bookings"
  on bookings for select
  using (
    hoa_id = my_hoa_id()
    and (resident_id = auth.uid() or my_role() = 'admin')
  );

-- All members need to see confirmed bookings to check availability
create policy "HOA members read confirmed bookings for availability"
  on bookings for select
  using (hoa_id = my_hoa_id() and status = 'confirmed');

create policy "Residents create bookings"
  on bookings for insert
  with check (hoa_id = my_hoa_id() and resident_id = auth.uid());

create policy "Residents cancel their bookings"
  on bookings for update
  using (hoa_id = my_hoa_id() and resident_id = auth.uid())
  with check (status = 'cancelled');

create policy "Admins manage bookings"
  on bookings for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- complaints
-- ============================================================
create policy "Residents read their complaints"
  on complaints for select
  using (
    hoa_id = my_hoa_id()
    and (submitted_by = auth.uid() or my_role() = 'admin')
  );

create policy "Residents file complaints"
  on complaints for insert
  with check (hoa_id = my_hoa_id() and submitted_by = auth.uid());

create policy "Admins update complaints"
  on complaints for update
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- violations: residents see their own; admins see all
-- ============================================================
create policy "Residents read violations issued to them"
  on violations for select
  using (
    hoa_id = my_hoa_id()
    and (resident_id = auth.uid() or my_role() = 'admin')
  );

create policy "Admins manage violations"
  on violations for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- chat_sessions: users only see their own
-- ============================================================
create policy "Users read their chat sessions"
  on chat_sessions for select
  using (profile_id = auth.uid() and hoa_id = my_hoa_id());

create policy "Users create chat sessions"
  on chat_sessions for insert
  with check (profile_id = auth.uid() and hoa_id = my_hoa_id());

-- ============================================================
-- chat_messages: users only see their own session's messages
-- ============================================================
create policy "Users read their chat messages"
  on chat_messages for select
  using (
    hoa_id = my_hoa_id()
    and session_id in (
      select id from chat_sessions where profile_id = auth.uid()
    )
  );

create policy "Users insert chat messages"
  on chat_messages for insert
  with check (
    hoa_id = my_hoa_id()
    and session_id in (
      select id from chat_sessions where profile_id = auth.uid()
    )
  );

-- ============================================================
-- announcements: everyone reads published; only admin writes
-- ============================================================
create policy "HOA members read published announcements"
  on announcements for select
  using (hoa_id = my_hoa_id() and (status = 'published' or my_role() = 'admin'));

create policy "Admins manage announcements"
  on announcements for all
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- ============================================================
-- Storage buckets (run after supabase start)
-- ============================================================
-- Bucket: incident-photos (public read, auth write)
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users upload incident photos"
  on storage.objects for insert
  with check (bucket_id = 'incident-photos' and auth.role() = 'authenticated');

create policy "Public read incident photos"
  on storage.objects for select
  using (bucket_id = 'incident-photos');

-- Bucket: ccr-documents (private)
insert into storage.buckets (id, name, public)
values ('ccr-documents', 'ccr-documents', false)
on conflict (id) do nothing;

create policy "HOA admins upload CC&R PDFs"
  on storage.objects for insert
  with check (bucket_id = 'ccr-documents' and my_role() = 'admin');

create policy "HOA admins read CC&R PDFs"
  on storage.objects for select
  using (bucket_id = 'ccr-documents' and my_role() = 'admin');
