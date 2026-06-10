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
import { embedText, searchCCRs } from './rag'

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

describe('searchCCRs', () => {
  it('returns matched chunks on success', async () => {
    const fakeEmbedding = Array(1536).fill(0.5)
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: fakeEmbedding }] })

    const chunks = [
      { id: 'chunk-1', content: 'Pool hours are 7am–10pm.', section_title: 'Section 4.2', similarity: 0.82 },
      { id: 'chunk-2', content: 'No glass containers allowed.', section_title: 'Section 4.3', similarity: 0.71 },
    ]
    const mock = buildSupabaseMock({ dbResult: { data: chunks, error: null } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const result = await searchCCRs('pool rules', 'hoa-1')

    expect(result).toHaveLength(2)
    expect(result[0].section_title).toBe('Section 4.2')
    expect(mock.rpc).toHaveBeenCalledWith('match_ccr_chunks', expect.objectContaining({
      p_hoa_id: 'hoa-1',
      match_count: 5,
      match_threshold: 0.5,
    }))
  })

  it('returns empty array when RPC fails', async () => {
    const fakeEmbedding = Array(1536).fill(0.5)
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: fakeEmbedding }] })

    const mock = buildSupabaseMock({ dbResult: { data: null, error: { message: 'RPC error' } } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const result = await searchCCRs('something', 'hoa-1')
    expect(result).toEqual([])
  })

  it('passes custom matchCount and matchThreshold to RPC', async () => {
    const fakeEmbedding = Array(1536).fill(0.5)
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: fakeEmbedding }] })

    const mock = buildSupabaseMock({ dbResult: { data: [], error: null } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    await searchCCRs('query', 'hoa-1', 10, 0.75)

    expect(mock.rpc).toHaveBeenCalledWith('match_ccr_chunks', expect.objectContaining({
      match_count: 10,
      match_threshold: 0.75,
    }))
  })
})
