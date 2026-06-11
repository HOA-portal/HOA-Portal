-- RAG query analytics — logs every CC&R search for admin visibility and threshold tuning

create table if not exists public.rag_query_logs (
  id              uuid        primary key default gen_random_uuid(),
  hoa_id          uuid        not null references public.hoas(id) on delete cascade,
  user_id         uuid        references auth.users(id) on delete set null,
  query_text      text        not null,
  match_count     integer     not null default 0,
  top_section_title text,
  avg_similarity  numeric(4,3),
  had_results     boolean     not null default false,
  created_at      timestamptz not null default now()
);

alter table public.rag_query_logs enable row level security;

-- Admins read their HOA's logs
create policy "admins_read_rag_logs"
  on public.rag_query_logs
  for select
  to authenticated
  using (hoa_id = my_hoa_id() and my_role() = 'admin');

-- Any authenticated user may insert logs scoped to their own HOA
create policy "authenticated_insert_rag_logs"
  on public.rag_query_logs
  for insert
  to authenticated
  with check (hoa_id = my_hoa_id());

create index on public.rag_query_logs (hoa_id, created_at desc);
create index on public.rag_query_logs (hoa_id, top_section_title) where top_section_title is not null;
