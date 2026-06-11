// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSupabaseMock } from '@/test/mocks/supabase'

// vi.mock is hoisted — use vi.hoisted() to share variables with the factory
const { mockEmbeddingsCreate } = vi.hoisted(() => ({
  mockEmbeddingsCreate: vi.fn(),
}))

vi.mock('openai', () => ({
  default: vi.fn(function MockOpenAI() {
    return {
      embeddings: { create: mockEmbeddingsCreate },
    }
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { embedText, searchCCRs, buildPassage, type RagChunk } from './rag'

const mockCreateClient = vi.mocked(createClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('embedText', () => {
  it('calls OpenAI with correct model and dimensions', async () => {
    const fakeEmbedding = Array(1536).fill(0.1)
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: fakeEmbedding }],
    })

    const result = await embedText('What is the pool schedule?')

    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'What is the pool schedule?',
      dimensions: 1536,
    })
    expect(result).toEqual(fakeEmbedding)
    expect(result).toHaveLength(1536)
  })
})

describe('buildPassage', () => {
  it('returns only main content when no adjacent chunks', () => {
    const chunk: RagChunk = {
      id: 'c1',
      content: 'Main text.',
      prev_content: null,
      next_content: null,
      section_title: 'Section 1',
      metadata: {},
      similarity: 0.8,
    }
    expect(buildPassage(chunk)).toBe('Main text.')
  })

  it('concatenates prev, main, and next with blank line separator', () => {
    const chunk: RagChunk = {
      id: 'c2',
      content: 'Middle text.',
      prev_content: 'Before text.',
      next_content: 'After text.',
      section_title: 'Section 2',
      metadata: {},
      similarity: 0.75,
    }
    expect(buildPassage(chunk)).toBe('Before text.\n\nMiddle text.\n\nAfter text.')
  })

  it('handles only prev_content being present', () => {
    const chunk: RagChunk = {
      id: 'c3',
      content: 'Last chunk.',
      prev_content: 'Previous chunk.',
      next_content: null,
      section_title: 'Section 3',
      metadata: {},
      similarity: 0.6,
    }
    expect(buildPassage(chunk)).toBe('Previous chunk.\n\nLast chunk.')
  })
})

describe('searchCCRs', () => {
  const fakeChunks = [
    {
      id: 'chunk-1',
      content: 'Pool hours are 7am–10pm.',
      prev_content: 'Amenity rules.',
      next_content: 'No exceptions.',
      section_title: 'Section 4.2',
      metadata: { hierarchy_path: 'Article IV > Section 4.2' },
      similarity: 0.82,
    },
    {
      id: 'chunk-2',
      content: 'No glass containers allowed.',
      prev_content: null,
      next_content: null,
      section_title: 'Section 4.3',
      metadata: {},
      similarity: 0.71,
    },
  ]

  it('returns matched chunks with prev/next context on success', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    const mock = buildSupabaseMock({ dbResult: { data: fakeChunks, error: null } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const result = await searchCCRs('pool rules', 'hoa-1')

    expect(result).toHaveLength(2)
    expect(result[0].section_title).toBe('Section 4.2')
    expect(result[0].prev_content).toBe('Amenity rules.')
    expect(result[0].next_content).toBe('No exceptions.')
    expect(result[1].prev_content).toBeNull()
  })

  it('calls match_ccr_chunks_with_context RPC', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    const mock = buildSupabaseMock({ dbResult: { data: fakeChunks, error: null } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    await searchCCRs('pool rules', 'hoa-1')

    expect(mock.rpc).toHaveBeenCalledWith('match_ccr_chunks_with_context', expect.objectContaining({
      p_hoa_id: 'hoa-1',
      match_count: 5,
      match_threshold: 0.5,
    }))
  })

  it('returns empty array when RPC fails', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    const mock = buildSupabaseMock({ dbResult: { data: null, error: { message: 'RPC error' } } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const result = await searchCCRs('something', 'hoa-1')
    expect(result).toEqual([])
  })

  it('passes custom matchCount and matchThreshold to RPC', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    const mock = buildSupabaseMock({ dbResult: { data: [], error: null } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    await searchCCRs('query', 'hoa-1', 10, 0.75)

    expect(mock.rpc).toHaveBeenCalledWith('match_ccr_chunks_with_context', expect.objectContaining({
      match_count: 10,
      match_threshold: 0.75,
    }))
  })

  it('fire-and-forget analytics insert does not throw on failure', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    // Mock: RPC succeeds, but analytics insert fails silently
    const mock = buildSupabaseMock({ dbResult: { data: fakeChunks, error: null } })
    const originalFrom = mock.from.bind(mock)
    mock.from = vi.fn((table: string) => {
      if (table === 'rag_query_logs') {
        return {
          insert: vi.fn().mockRejectedValue(new Error('DB write permission denied')),
        }
      }
      return originalFrom(table)
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    // searchCCRs must resolve normally even when analytics insert throws
    const result = await searchCCRs('pool rules', 'hoa-1')
    expect(result).toHaveLength(2)
  })

  it('analytics logs had_results=false when no chunks found', async () => {
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.5) }] })

    const insertSpy = vi.fn().mockResolvedValue({ error: null })
    const mock = buildSupabaseMock({ dbResult: { data: [], error: null } })
    mock.from = vi.fn((table: string) => {
      if (table === 'rag_query_logs') return { insert: insertSpy }
      return buildSupabaseMock({ dbResult: { data: [], error: null } }).from(table)
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    await searchCCRs('obscure query with no results', 'hoa-1')

    // Wait for the fire-and-forget microtask to flush
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        had_results: false,
        match_count: 0,
        query_text: 'obscure query with no results',
      })
    )
  })
})
