import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

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

/**
 * HyDE — Hypothetical Document Embeddings.
 * Generates a "hypothetical CC&R rule" from the resident's casual question,
 * then embeds that formal text instead of the raw query. Bridges the semantic
 * gap between casual questions and legal CC&R language.
 * Always falls back to the original query on any error.
 */
async function hydeExpand(query: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      maxTokens: 150,
      messages: [{
        role: 'user',
        content: `Write a 2-3 sentence HOA CC&R rule that directly addresses this question: "${query}"\n\nWrite only the rule text, using formal legal language as it would appear in a CC&R document. Do not include preamble or explanation.`,
      }],
    })
    return text.trim() || query
  } catch {
    return query
  }
}

/**
 * LLM Reranking — after RRF hybrid search returns candidates, ask Claude Haiku
 * to reorder by true relevance to the original question. Removes false positives
 * that have good vector similarity but don't answer the question.
 * Always falls back to the original order on any error.
 */
async function rerankChunks(
  query: string,
  chunks: RagChunk[],
  topN: number
): Promise<RagChunk[]> {
  if (chunks.length <= topN) return chunks

  const numbered = chunks.map((c, i) =>
    `[${i + 1}] ${c.section_title ?? 'General'}: ${c.content.slice(0, 300)}`
  ).join('\n\n')

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      maxTokens: 60,
      messages: [{
        role: 'user',
        content: `Resident question: "${query}"\n\nRank these CC&R sections by relevance. Reply with only the numbers in order from most to least relevant, comma-separated (e.g.: 3,1,5,2,4).\n\n${numbered}`,
      }],
    })
    const indices = text.match(/\d+/g)?.map(Number) ?? []
    const seen = new Set<number>()
    const reranked = indices
      .filter(i => i >= 1 && i <= chunks.length && !seen.has(i) && seen.add(i))
      .map(i => chunks[i - 1])

    // Fill remaining slots from original order if reranking returned fewer than topN
    const rerankedIds = new Set(reranked.map(c => c.id))
    const remaining = chunks.filter(c => !rerankedIds.has(c.id))
    return [...reranked, ...remaining].slice(0, topN)
  } catch {
    return chunks.slice(0, topN)
  }
}

export async function searchCCRs(
  query: string,
  hoaId: string,
  matchCount = 5,
  matchThreshold = 0.15,
  useHyde = true
): Promise<RagChunk[]> {
  // HyDE: embed a hypothetical CC&R rule rather than the raw question.
  // Falls back to original query if Claude is unavailable.
  const queryForEmbedding = useHyde ? await hydeExpand(query) : query
  const embedding = await embedText(queryForEmbedding)
  const supabase = await createClient()

  // Retrieve 2× candidates so the reranker has room to improve ordering.
  const { data, error } = await supabase.rpc('match_ccr_chunks_with_context', {
    query_embedding: embedding,
    query_text: query,       // original query for full-text search arm
    match_threshold: matchThreshold,
    match_count: matchCount * 2,
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

  // Rerank: Claude Haiku picks the most relevant chunks from the candidate set.
  const reranked = await rerankChunks(query, results, matchCount)

  // Fire-and-forget analytics log — never blocks the search response
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const avgSimilarity = reranked.length > 0
        ? reranked.reduce((sum, c) => sum + c.similarity, 0) / reranked.length
        : null

      await supabase.from('rag_query_logs').insert({
        hoa_id: hoaId,
        user_id: user?.id ?? null,
        query_text: query,
        match_count: reranked.length,
        top_section_title: reranked[0]?.section_title ?? null,
        avg_similarity: avgSimilarity !== null ? Number(avgSimilarity.toFixed(3)) : null,
        had_results: reranked.length > 0,
      })
    } catch {
      // Analytics failures are silent — never impact search
    }
  })()

  return reranked
}
