// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// signup/route.ts uses @supabase/supabase-js directly (not the SSR wrapper)
const mockCreateUser = vi.fn()
const mockDeleteUser = vi.fn()
const mockFromFn = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFromFn,
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
  })),
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0]
}

function makeChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockResolvedValue(result),
    delete: vi.fn().mockReturnThis(),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/signup', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ email: 'user@test.com' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Missing required fields/)
  })

  it('returns 404 when HOA subdomain does not exist', async () => {
    mockFromFn.mockReturnValue(makeChain({ data: null, error: { message: 'Not found' } }))
    const res = await POST(makeRequest({
      email: 'user@test.com',
      password: 'pass123',
      hoaSubdomain: 'nonexistent-hoa',
    }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Community not found/)
  })

  it('returns 200 and creates profile on valid signup', async () => {
    mockFromFn.mockImplementation((table: string) => {
      if (table === 'hoas') return makeChain({ data: { id: 'hoa-1' }, error: null })
      if (table === 'profiles') return makeChain({ data: null, error: null })
      return makeChain({ data: null, error: null })
    })
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-1' } },
      error: null,
    })
    const res = await POST(makeRequest({
      email: 'newuser@test.com',
      password: 'secret123',
      fullName: 'Jane Doe',
      unitNumber: '42',
      hoaSubdomain: 'sunrise-hoa',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('deletes auth user and returns 500 when profile insert fails', async () => {
    mockFromFn.mockImplementation((table: string) => {
      if (table === 'hoas') return makeChain({ data: { id: 'hoa-1' }, error: null })
      if (table === 'profiles') return makeChain({ data: null, error: { message: 'Duplicate key' } })
      return makeChain({ data: null, error: null })
    })
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-1' } },
      error: null,
    })
    mockDeleteUser.mockResolvedValue({ error: null })

    const res = await POST(makeRequest({
      email: 'newuser@test.com',
      password: 'secret123',
      hoaSubdomain: 'sunrise-hoa',
    }))
    expect(res.status).toBe(500)
    expect(mockDeleteUser).toHaveBeenCalledWith('new-user-1')
  })
})
