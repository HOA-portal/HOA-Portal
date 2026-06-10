// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSupabaseMock } from '@/test/mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  updateWorkOrder,
  updateComplaint,
  issueViolation,
  updateViolationStatus,
  createAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
} from './actions'

const mockCreateClient = vi.mocked(createClient)

function setupAdmin(dbResult = { data: null, error: null }) {
  mockCreateClient.mockResolvedValue(
    buildSupabaseMock({ dbResult }) as ReturnType<typeof buildSupabaseMock>
  )
}

function setupResident() {
  mockCreateClient.mockResolvedValue(
    buildSupabaseMock({ profile: { role: 'resident', hoa_id: 'hoa-1' } }) as ReturnType<typeof buildSupabaseMock>
  )
}

function setupDbError(message: string) {
  setupAdmin({ data: null, error: { message } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── requireAdmin ──────────────────────────────────────────────────────────────

describe('requireAdmin (implicit via actions)', () => {
  it('redirects to /chat when user is a resident', async () => {
    setupResident()
    await expect(updateWorkOrder('wo-1', { status: 'open' })).rejects.toThrow('REDIRECT:/chat')
  })

  it('redirects to /login when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue(
      buildSupabaseMock({ user: null }) as ReturnType<typeof buildSupabaseMock>
    )
    await expect(updateWorkOrder('wo-1', { status: 'open' })).rejects.toThrow('REDIRECT:/login')
  })
})

// ── updateWorkOrder ───────────────────────────────────────────────────────────

describe('updateWorkOrder', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await updateWorkOrder('wo-1', { status: 'in_progress', admin_notes: 'noted' })
    expect(result).toEqual({})
  })

  it('returns { error } when DB update fails', async () => {
    setupDbError('Connection timeout')
    const result = await updateWorkOrder('wo-1', { status: 'resolved' })
    expect(result).toEqual({ error: 'Connection timeout' })
  })
})

// ── updateComplaint ───────────────────────────────────────────────────────────

describe('updateComplaint', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await updateComplaint('c-1', { status: 'resolved', admin_notes: 'done' })
    expect(result).toEqual({})
  })

  it('returns { error } when DB update fails', async () => {
    setupDbError('Conflict')
    const result = await updateComplaint('c-1', { status: 'closed' })
    expect(result).toEqual({ error: 'Conflict' })
  })
})

// ── issueViolation ────────────────────────────────────────────────────────────

describe('issueViolation', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await issueViolation('v-1', 'Dear resident, you have violated rule 5.2...')
    expect(result).toEqual({})
  })

  it('returns { error } when DB update fails', async () => {
    setupDbError('Row not found')
    const result = await issueViolation('v-1', 'Formal notice text')
    expect(result).toEqual({ error: 'Row not found' })
  })
})

// ── updateViolationStatus ─────────────────────────────────────────────────────

describe('updateViolationStatus', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await updateViolationStatus('v-1', 'resolved')
    expect(result).toEqual({})
  })

  it('returns { error } on DB failure', async () => {
    setupDbError('DB locked')
    const result = await updateViolationStatus('v-1', 'closed')
    expect(result).toEqual({ error: 'DB locked' })
  })
})

// ── createAnnouncement ────────────────────────────────────────────────────────

describe('createAnnouncement', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await createAnnouncement({
      subject: 'Pool Closure',
      body: 'The pool will be closed on Dec 15.',
      send_email: true,
      send_sms: false,
    })
    expect(result).toEqual({})
  })

  it('returns { error } on DB failure', async () => {
    setupDbError('Insert failed')
    const result = await createAnnouncement({
      subject: 'Test',
      body: 'Body',
      send_email: false,
      send_sms: false,
    })
    expect(result).toEqual({ error: 'Insert failed' })
  })
})

// ── publishAnnouncement ───────────────────────────────────────────────────────

describe('publishAnnouncement', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await publishAnnouncement('a-1')
    expect(result).toEqual({})
  })

  it('returns { error } on DB failure', async () => {
    setupDbError('Already published')
    const result = await publishAnnouncement('a-1')
    expect(result).toEqual({ error: 'Already published' })
  })
})

// ── deleteAnnouncement ────────────────────────────────────────────────────────

describe('deleteAnnouncement', () => {
  it('returns {} on success', async () => {
    setupAdmin()
    const result = await deleteAnnouncement('a-1')
    expect(result).toEqual({})
  })

  it('returns { error } on DB failure', async () => {
    setupDbError('Not found')
    const result = await deleteAnnouncement('a-1')
    expect(result).toEqual({ error: 'Not found' })
  })
})
