// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSupabaseMock } from '@/test/mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Prevent actual AI streaming in tests
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: vi.fn(() => new Response('ok', { status: 200 })),
  })),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => ({})),
}))

vi.mock('@/lib/ai/admin-tools', () => ({
  buildAdminTools: vi.fn(() => ({})),
}))

vi.mock('@/lib/ai/system-prompts', () => ({
  buildAdminSystemPrompt: vi.fn(() => 'system prompt'),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

const mockCreateClient = vi.mocked(createClient)

function makeRequest(body = { messages: [], sessionId: 'session-1' }) {
  return new Request('http://localhost/api/agent/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agent/admin', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ user: null }) as ReturnType<typeof buildSupabaseMock>
    )
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 when user role is resident', async () => {
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ profile: { role: 'resident', hoa_id: 'hoa-1' } }) as ReturnType<typeof buildSupabaseMock>
    )
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 200 when user is an admin', async () => {
    const mock = buildSupabaseMock({ profile: { role: 'admin', hoa_id: 'hoa-1' } })
    // Mock hoa fetch (second from() call after profiles)
    let fromCallCount = 0
    const originalFrom = mock.from
    mock.from = vi.fn((table: string) => {
      fromCallCount++
      if (table === 'hoas') {
        const { buildSupabaseMock: _, ...rest } = { buildSupabaseMock: null }
        void rest
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { name: 'Test HOA' }, error: null }),
        }
        return chain
      }
      return originalFrom(table)
    })
    mockCreateClient.mockResolvedValue(mock as ReturnType<typeof buildSupabaseMock>)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    void fromCallCount
  })
})
