-- Migration 007: RAG context windows
-- Adds match_ccr_chunks_with_context — same RRF hybrid search as match_ccr_chunks,
-- but each matched chunk also returns the adjacent chunks from the same document
-- (prev_content and next_content) so the LLM receives broader passage context.

create or replace function match_ccr_chunks_with_context(
  query_embedding  vector(1536),
  query_text       text,
  match_threshold  float,
  match_count      int,
  p_hoa_id         uuid,
  rrf_k            int default 60
)
returns table (
  id             uuid,
  content        text,
  prev_content   text,
  next_content   text,
  section_title  text,
  metadata       jsonb,
  similarity     float
)
language sql stable
as $$
  with vector_results as (
    select
      c.id,
      c.content,
      c.section_title,
      c.metadata,
      c.document_id,
      c.chunk_index,
      row_number() over (order by c.embedding <=> query_embedding) as vector_rank
    from ccr_chunks c
    where
      c.hoa_id = p_hoa_id
      and c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count * 4
  ),
  text_results as (
    select
      c.id,
      c.content,
      c.section_title,
      c.metadata,
      c.document_id,
      c.chunk_index,
      row_number() over (
        order by ts_rank_cd(c.search_vector, websearch_to_tsquery('english', query_text)) desc
      ) as text_rank
    from ccr_chunks c
    where
      c.hoa_id = p_hoa_id
      and query_text is not null
      and query_text <> ''
      and c.search_vector @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(c.search_vector, websearch_to_tsquery('english', query_text)) desc
    limit match_count * 4
  ),
  rrf_ranked as (
    select
      coalesce(v.id, t.id)                              as id,
      coalesce(v.content, t.content)                    as content,
      coalesce(v.section_title, t.section_title)        as section_title,
      coalesce(v.metadata, t.metadata, '{}'::jsonb)     as metadata,
      coalesce(v.document_id, t.document_id)            as document_id,
      coalesce(v.chunk_index, t.chunk_index)            as chunk_index,
      coalesce(1.0 / (rrf_k + v.vector_rank), 0.0) +
      coalesce(1.0 / (rrf_k + t.text_rank),  0.0)      as rrf_score
    from vector_results v
    full outer join text_results t on v.id = t.id
    order by rrf_score desc
    limit match_count
  )
  select
    r.id,
    r.content,
    prev_c.content  as prev_content,
    next_c.content  as next_content,
    r.section_title,
    r.metadata,
    r.rrf_score     as similarity
  from rrf_ranked r
  left join ccr_chunks prev_c
    on prev_c.document_id = r.document_id
   and prev_c.chunk_index = r.chunk_index - 1
   and prev_c.hoa_id = p_hoa_id
  left join ccr_chunks next_c
    on next_c.document_id = r.document_id
   and next_c.chunk_index = r.chunk_index + 1
   and next_c.hoa_id = p_hoa_id;
$$;
