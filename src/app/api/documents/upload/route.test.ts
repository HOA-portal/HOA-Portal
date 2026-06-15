// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — use vi.hoisted() to share variables with the factory
const { mockCreateClient, mockCreateServiceClient, mockFetch } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateServiceClient: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
  createServiceClient: mockCreateServiceClient,
}))

// Mock global fetch used for the fire-and-forget Edge Function trigger
vi.stubGlobal('fetch', mockFetch)

import { POST } from './route'

// Creates a chainable Supabase query builder that resolves to `result` when awaited.
function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'filter']
  for (const m of methods) c[m] = vi.fn(() => c)
  c['single'] = vi.fn(() => Promise.resolve(result))
  c['maybeSingle'] = vi.fn(() => Promise.resolve(result))
  // `then` makes the chain directly awaitable without a terminal method
  c['then'] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej)
  return c
}

// Admin profile mock (default happy-path)
const adminProfile = { data: { role: 'admin', hoa_id: 'hoa-1' }, error: null }

// Builds a Supabase mock tuned for the upload route's exact call sequence:
//   from('profiles')         → profile
//   from('ccr_documents') #1 → { count: N }   (rate limit check)
//   from('ccr_documents') #2 → { data: doc }   (duplicate check)
//   from('ccr_documents') #3 → { data: { id } } (insert)
//   storage.from().upload()  → { error }
function buildMock({
  user = { id: 'user-1' },
  profile = adminProfile,
  rateCount = 0,
  existingDoc = null as unknown,
  insertResult = { data: { id: 'doc-1' }, error: null } as unknown,
  storageError = null as unknown,
} = {}) {
  let ccrCallCount = 0

  mockCreateServiceClient.mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ error: null }),
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return chain(profile)
      if (table === 'ccr_documents') {
        ccrCallCount++
        if (ccrCallCount === 1) return chain({ count: rateCount })
        if (ccrCallCount === 2) return chain({ data: existingDoc })
        return chain(insertResult)
      }
      return chain({ data: null, error: null })
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: storageError }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  }
}

// A File with valid PDF magic bytes (%PDF = 0x25 0x50 0x44 0x46)
function makePdfFile(sizeBytes = 1024) {
  const bytes = new Uint8Array(sizeBytes)
  bytes[0] = 0x25; bytes[1] = 0x50; bytes[2] = 0x44; bytes[3] = 0x46
  return new File([bytes], 'ccrs.pdf', { type: 'application/pdf' })
}

function makeRequest(file?: File) {
  const form = new FormData()
  if (file) form.append('file', file)
  return new Request('http://localhost/api/documents/upload', {
    method: 'POST',
    body: form,
  }) as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  // fire-and-forget trigger resolves silently — doesn't block the response
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

describe('POST /api/documents/upload', () => {
  it('returns 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    })
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is a resident, not admin', async () => {
    mockCreateClient.mockResolvedValue(
      buildMock({ profile: { data: { role: 'resident', hoa_id: 'hoa-1' }, error: null } })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(403)
  })

  it('returns 413 when file exceeds 50 MB', async () => {
    mockCreateClient.mockResolvedValue(buildMock())
    const bigFile = new File([new Uint8Array(51 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' })
    const res = await POST(makeRequest(bigFile))
    expect(res.status).toBe(413)
  })

  it('returns 415 for non-PDF/image file (invalid magic bytes)', async () => {
    mockCreateClient.mockResolvedValue(buildMock())
    // Plain text — wrong magic bytes
    const textFile = new File(['not a pdf at all'], 'rules.txt', { type: 'text/plain' })
    const res = await POST(makeRequest(textFile))
    expect(res.status).toBe(415)
  })

  it('returns 429 when rate limit (10 uploads/hour) is exceeded', async () => {
    mockCreateClient.mockResolvedValue(buildMock({ rateCount: 10 }))
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(429)
  })

  it('returns 500 when Supabase Storage upload fails', async () => {
    mockCreateClient.mockResolvedValue(
      buildMock({ storageError: { message: 'Bucket not found' } })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/Storage upload failed/)
  })

  it('returns 202 with documentId and status=pending on success', async () => {
    mockCreateClient.mockResolvedValue(buildMock())
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.documentId).toBe('doc-1')
    expect(body.status).toBe('pending')
  })

  it('returns 202 with duplicateWarning when filename already exists', async () => {
    mockCreateClient.mockResolvedValue(
      buildMock({ existingDoc: { id: 'old-doc-99', status: 'completed' } })
    )
    const res = await POST(makeRequest(makePdfFile()))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.duplicateWarning).toBe(true)
    expect(body.existingDocumentId).toBe('old-doc-99')
  })
})
