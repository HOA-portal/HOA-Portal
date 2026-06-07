-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists btree_gist; -- required for booking overlap exclusion constraint

-- ============================================================
-- HOAs (tenants)
-- ============================================================
create table hoas (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  subdomain   text unique not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Profiles (one per auth.users row)
-- ============================================================
create type user_role as enum ('resident', 'admin');

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  hoa_id       uuid not null references hoas(id) on delete cascade,
  role         user_role not null default 'resident',
  full_name    text,
  unit_number  text,
  phone        text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- CC&R Documents (uploaded PDFs)
-- ============================================================
create table ccr_documents (
  id            uuid primary key default uuid_generate_v4(),
  hoa_id        uuid not null references hoas(id) on delete cascade,
  filename      text not null,
  storage_path  text not null,
  uploaded_by   uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- CC&R Chunks (embedded text chunks for RAG)
-- ============================================================
create table ccr_chunks (
  id             uuid primary key default uuid_generate_v4(),
  hoa_id         uuid not null references hoas(id) on delete cascade,
  document_id    uuid not null references ccr_documents(id) on delete cascade,
  content        text not null,
  section_title  text,
  embedding      vector(1536),
  chunk_index    integer not null,
  created_at     timestamptz not null default now()
);

-- Index for pgvector similarity search
create index ccr_chunks_embedding_idx on ccr_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- Work Orders
-- ============================================================
create type work_order_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type work_order_priority as enum ('low', 'medium', 'high', 'urgent');

create table work_orders (
  id            uuid primary key default uuid_generate_v4(),
  hoa_id        uuid not null references hoas(id) on delete cascade,
  submitted_by  uuid not null references profiles(id),
  title         text not null,
  description   text not null,
  status        work_order_status not null default 'open',
  priority      work_order_priority not null default 'medium',
  photo_urls    text[] not null default '{}',
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger work_orders_updated_at
  before update on work_orders
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Amenities
-- ============================================================
create table amenities (
  id           uuid primary key default uuid_generate_v4(),
  hoa_id       uuid not null references hoas(id) on delete cascade,
  name         text not null,
  description  text,
  capacity     integer,
  rules        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Bookings
-- ============================================================
create type booking_status as enum ('confirmed', 'cancelled');

create table bookings (
  id           uuid primary key default uuid_generate_v4(),
  hoa_id       uuid not null references hoas(id) on delete cascade,
  amenity_id   uuid not null references amenities(id) on delete cascade,
  resident_id  uuid not null references profiles(id),
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  status       booking_status not null default 'confirmed',
  notes        text,
  created_at   timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    amenity_id with =,
    daterange(date, date, '[]') with &&,
    tsrange(
      (date + start_time)::timestamp,
      (date + end_time)::timestamp
    ) with &&
  ) where (status = 'confirmed'),
  constraint end_after_start check (end_time > start_time)
);

-- ============================================================
-- Complaints
-- ============================================================
create type complaint_category as enum ('noise', 'parking', 'property', 'neighbor', 'maintenance', 'other');
create type complaint_status as enum ('open', 'under_review', 'resolved', 'closed');

create table complaints (
  id            uuid primary key default uuid_generate_v4(),
  hoa_id        uuid not null references hoas(id) on delete cascade,
  submitted_by  uuid not null references profiles(id),
  subject       text not null,
  description   text not null,
  category      complaint_category not null default 'other',
  status        complaint_status not null default 'open',
  admin_notes   text,
  evidence_urls text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger complaints_updated_at
  before update on complaints
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Violations
-- ============================================================
create type violation_status as enum ('draft', 'issued', 'appealed', 'resolved', 'closed');

create table violations (
  id              uuid primary key default uuid_generate_v4(),
  hoa_id          uuid not null references hoas(id) on delete cascade,
  resident_id     uuid references profiles(id),
  reported_by     uuid not null references profiles(id),
  resident_unit   text,
  description     text not null,
  rule_reference  text,
  photo_urls      text[] not null default '{}',
  status          violation_status not null default 'draft',
  fine_amount     numeric(10,2),
  formal_notice   text,
  issued_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger violations_updated_at
  before update on violations
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Chat Sessions
-- ============================================================
create table chat_sessions (
  id          uuid primary key default uuid_generate_v4(),
  hoa_id      uuid not null references hoas(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Chat Messages
-- ============================================================
create type message_role as enum ('user', 'assistant', 'tool');

create table chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  hoa_id      uuid not null references hoas(id) on delete cascade,
  role        message_role not null,
  content     text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index chat_messages_session_idx on chat_messages (session_id, created_at);

-- ============================================================
-- Announcements
-- ============================================================
create type announcement_status as enum ('draft', 'published');

create table announcements (
  id           uuid primary key default uuid_generate_v4(),
  hoa_id       uuid not null references hoas(id) on delete cascade,
  created_by   uuid not null references profiles(id),
  subject      text not null,
  body         text not null,
  status       announcement_status not null default 'draft',
  send_email   boolean not null default false,
  send_sms     boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger announcements_updated_at
  before update on announcements
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- pgvector similarity search RPC
-- ============================================================
create or replace function match_ccr_chunks(
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int,
  p_hoa_id         uuid
)
returns table (
  id             uuid,
  content        text,
  section_title  text,
  similarity     float
)
language sql stable
as $$
  select
    c.id,
    c.content,
    c.section_title,
    1 - (c.embedding <=> query_embedding) as similarity
  from ccr_chunks c
  where
    c.hoa_id = p_hoa_id
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
