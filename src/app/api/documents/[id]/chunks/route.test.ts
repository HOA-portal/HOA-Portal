// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSupabaseMock } from '@/test/mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

const mockCreateClient = vi.mocked(createClient)

function makeRequest(documentId: string, query = '') {
  return new Request(`http://localhost/api/documents/${documentId}/chunks${query}`, {
    method: 'GET',
  })
}

// Builds a multi-table Supabase mock that handles:
//   from('profiles')  → profile data
//   from('ccr_documents') → document data
//   from('ccr_chunks') → chunks data
function buildChunksMock(opts: {
  profile?: { role: string } | null
  document?: { id: string; status: string } | null
  chunks?: unknown[] | null
  chunkCount?: number
}) {
  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.profile,
            error: opts.profile ? null : { message: 'Not found' },
          }),
        }
      }

      if (table === 'ccr_documents') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: opts.document,
            error: opts.document ? null : { message: 'Not found' },
          }),
        }
      }

      if (table === 'ccr_chunks') {
        const count = opts.chunkCount ?? (opts.chunks?.length ?? 0)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: opts.chunks ?? [], error: null, count }),
        }
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
      }
    }),
  }
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
})

const fakeChunks = [
  {
    id: 'chunk-1',
    chunk_index: 0,
    section_title: 'Section 4.2',
    content: 'Pool hours are 7am–10pm daily.',
    metadata: { hierarchy_path: 'Article IV > Section 4.2', article: 'IV', section: '4.2' },
  },
  {
    id: 'chunk-2',
    chunk_index: 1,
    section_title: 'Section 4.3',
    content: 'No glass containers are allowed in pool area.',
    metadata: { hierarchy_path: 'Article IV > Section 4.3' },
  },
]

describe('GET /api/documents/[id]/chunks', () => {
  it('returns 401 when user is not authenticated', async () => {
    const mock = buildSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user role is resident', async () => {
    const mock = buildChunksMock({ profile: { role: 'resident' } })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when document does not exist', async () => {
    const mock = buildChunksMock({
      profile: { role: 'admin' },
      document: null,
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('nonexistent'), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when document is not completed', async () => {
    const mock = buildChunksMock({
      profile: { role: 'admin' },
      document: { id: 'doc-1', status: 'processing' },
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/completed/)
  })

  it('returns paginated chunk list for completed document', async () => {
    const mock = buildChunksMock({
      profile: { role: 'admin' },
      document: { id: 'doc-1', status: 'completed' },
      chunks: fakeChunks,
      chunkCount: 2,
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.items).toHaveLength(2)
    expect(body.items[0].chunk_index).toBe(0)
    expect(body.items[0].section_title).toBe('Section 4.2')
    expect(body.items[0].hierarchy_path).toBe('Article IV > Section 4.2')
  })

  it('truncates content_preview to 300 chars', async () => {
    const longContent = 'A'.repeat(400)
    const mock = buildChunksMock({
      profile: { role: 'admin' },
      document: { id: 'doc-1', status: 'completed' },
      chunks: [{ id: 'c1', chunk_index: 0, section_title: null, content: longContent, metadata: {} }],
      chunkCount: 1,
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(makeRequest('doc-1'), { params: Promise.resolve({ id: 'doc-1' }) })
    const body = await res.json()
    expect(body.items[0].content_preview).toHaveLength(301) // 300 + '…'
    expect(body.items[0].content_preview.endsWith('…')).toBe(true)
    expect(body.items[0].content_length).toBe(400)
  })

  it('respects custom page and limit query params', async () => {
    const mock = buildChunksMock({
      profile: { role: 'admin' },
      document: { id: 'doc-1', status: 'completed' },
      chunks: [],
      chunkCount: 50,
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)

    const res = await GET(
      makeRequest('doc-1', '?page=3&limit=10'),
      { params: Promise.resolve({ id: 'doc-1' }) }
    )
    const body = await res.json()
    expect(body.page).toBe(3)
    expect(body.limit).toBe(10)
    expect(body.pages).toBe(5)
  })
})
