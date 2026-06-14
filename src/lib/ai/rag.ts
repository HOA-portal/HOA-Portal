import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  })
  return response.data[0].embedding
}

export interface RagChunk {
  id: string
  content: string
  prev_content: string | null
  next_content: string | null
  section_title: string | null
  metadata: Record<string, unknown>
  similarity: number
}

/** Assemble full passage: prev + main + next chunk, separated by blank lines. */
export function buildPassage(chunk: RagChunk): string {
  return [chunk.prev_content, chunk.content, chunk.next_content]
    .filter(Boolean)
    .join('\n\n')
}

export async function searchCCRs(
  query: string,
  hoaId: string,
  matchCount = 5,
  matchThreshold = 0.5
): Promise<RagChunk[]> {
  const embedding = await embedText(query)
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_ccr_chunks_with_context', {
    query_embedding: embedding,
    query_text: query,
    match_threshold: matchThreshold,
    match_count: matchCount,
    p_hoa_id: hoaId,
  })

  if (error) {
    console.error('RAG search error:', error)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    content: string
    prev_content: string | null
    next_content: string | null
    section_title: string | null
    metadata: unknown
    similarity: number
  }>
  const results: RagChunk[] = rows.map(row => ({
    id: row.id,
    content: row.content,
    prev_content: row.prev_content ?? null,
    next_content: row.next_content ?? null,
    section_title: row.section_title ?? null,
    metadata: row.metadata as Record<string, unknown>,
    similarity: row.similarity,
  }))

  // Fire-and-forget analytics log — never blocks the search response
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const avgSimilarity = results.length > 0
        ? results.reduce((sum, c) => sum + c.similarity, 0) / results.length
        : null

      await supabase.from('rag_query_logs').insert({
        hoa_id: hoaId,
        user_id: user?.id ?? null,
        query_text: query,
        match_count: results.length,
        top_section_title: results[0]?.section_title ?? null,
        avg_similarity: avgSimilarity !== null ? Number(avgSimilarity.toFixed(3)) : null,
        had_results: results.length > 0,
      })
    } catch {
      // Analytics failures are silent — never impact search
    }
  })()

  return results
}
