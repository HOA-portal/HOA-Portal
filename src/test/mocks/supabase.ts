import { vi } from 'vitest'

type DbResult = { data?: unknown; error?: { message: string } | null }

// Creates a chainable object that resolves to `result` when awaited directly
// (i.e. `await supabase.from('x').update({}).eq('id', '1')`) and also supports
// `.single()` as a terminal method that resolves to `result`.
function makeChain(result: DbResult): Record<string, unknown> {
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'lt', 'gt',
    'in', 'order', 'limit', 'filter', 'rpc',
  ]
  const chain: Record<string, unknown> = {}

  for (const m of methods) {
    chain[m] = vi.fn((..._args: unknown[]) => chain)
  }

  // Terminal: .single() / .maybeSingle()
  chain['single'] = vi.fn(() => Promise.resolve(result))
  chain['maybeSingle'] = vi.fn(() => Promise.resolve(result))

  // Make directly awaitable: `await chain`
  chain['then'] = (
    onFulfilled: (v: DbResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected)

  return chain
}

export interface SupabaseMockOptions {
  user?: { id: string } | null
  userError?: unknown
  profile?: { role: string; hoa_id: string } | null
  profileError?: unknown
  dbResult?: DbResult
}

/**
 * Returns a mock Supabase client. Pass options to configure per-test
 * return values.  Use `vi.mocked(createClient).mockResolvedValue(...)` to
 * inject different mocks inside the same describe block.
 */
export function buildSupabaseMock(opts: SupabaseMockOptions = {}) {
  const {
    user = { id: 'user-1' },
    userError = null,
    profile = { role: 'admin', hoa_id: 'hoa-1' },
    profileError = null,
    dbResult = { data: null, error: null },
  } = opts

  const profileChain = makeChain({ data: profile, error: profileError })
  const dbChain = makeChain(dbResult)

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: userError }),
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: user ? { id: user.id } : null },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profileChain
      return dbChain
    }),
    rpc: vi.fn().mockResolvedValue(dbResult),
  }
}
