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
  section_title: string | null
  metadata: Record<string, unknown>
  similarity: number
}

export async function searchCCRs(
  query: string,
  hoaId: string,
  matchCount = 5,
  matchThreshold = 0.5
): Promise<RagChunk[]> {
  const embedding = await embedText(query)
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('match_ccr_chunks', {
    query_embedding: embedding,
    query_text: query,
    match_threshold: matchThreshold,
    match_count: matchCount,
    p_hoa_id: hoaId,
  }) as { data: RagChunk[] | null; error: unknown }

  if (error) {
    console.error('RAG search error:', error)
    return []
  }

  return (data ?? []) as RagChunk[]
}
