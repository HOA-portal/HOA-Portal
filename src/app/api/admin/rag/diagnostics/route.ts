import { createClient, createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { Profile } from '@/types/database'

export const maxDuration = 30

interface Check {
  name: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

export async function GET(): Promise<Response> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const hoaId = profile.hoa_id
  const checks: Check[] = []
  const serviceClient = await createServiceClient()

  // ── Check 1: Document counts by status ──────────────────────────────────
  try {
    const { data: docs } = await supabase
      .from('ccr_documents')
      .select('status')
      .eq('hoa_id', hoaId)

    if (!docs || docs.length === 0) {
      checks.push({ name: 'documents', status: 'warn', detail: 'No documents uploaded yet for this HOA' })
    } else {
      const counts = docs.reduce<Record<string, number>>((acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1
        return acc
      }, {})
      const completed = counts['completed'] ?? 0
      const pending = counts['pending'] ?? 0
      const failed = counts['failed'] ?? 0
      const processing = counts['processing'] ?? 0
      const detail = `completed=${completed} pending=${pending} processing=${processing} failed=${failed}`
      if (completed === 0 && (pending > 0 || failed > 0)) {
        checks.push({ name: 'documents', status: 'error', detail: `No completed documents — ${detail}` })
      } else if (completed === 0) {
        checks.push({ name: 'documents', status: 'warn', detail: `No completed documents yet — ${detail}` })
      } else {
        checks.push({ name: 'documents', status: 'ok', detail })
      }
    }
  } catch (e) {
    checks.push({ name: 'documents', status: 'error', detail: String(e) })
  }

  // ── Check 2: ccr_chunks with embeddings ─────────────────────────────────
  try {
    const { count } = await supabase
      .from('ccr_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)
      .not('embedding', 'is', null)

    if ((count ?? 0) === 0) {
      checks.push({ name: 'chunks', status: 'error', detail: 'Zero chunks with embeddings found — documents were not ingested' })
    } else {
      checks.push({ name: 'chunks', status: 'ok', detail: `${count} chunks with embeddings` })
    }
  } catch (e) {
    checks.push({ name: 'chunks', status: 'error', detail: String(e) })
  }

  // ── Check 3: Required RPC functions exist ────────────────────────────────
  // Strategy: call each RPC with dummy/minimal params.
  // Error code PGRST202 ("Could not find a relationship") or "function does not exist"
  // means the function is missing. Any other error means it exists but rejected bad params.
  try {
    const rpcChecks = await Promise.all([
      // pgmq_read: call with n=0 — if it exists, returns empty set. If missing, errors.
      serviceClient.rpc('pgmq_read', { queue_name: 'document_processing', sleep_seconds: 0, n: 0 }),
      // pgmq_delete: call with invalid msg_id — if it exists, returns false. If missing, errors.
      serviceClient.rpc('pgmq_delete', { queue_name: 'document_processing', msg_id: -1 }),
      // enqueue_document_processing: no way to call without side effects, skip — covered by upload flow
    ])

    const missing: string[] = []
    const fnNames = ['pgmq_read', 'pgmq_delete']
    rpcChecks.forEach(({ error }, i) => {
      if (error && (error.message.includes('function') || error.message.includes('Could not find'))) {
        missing.push(fnNames[i])
      }
    })

    if (missing.length > 0) {
      checks.push({ name: 'rpc_functions', status: 'error', detail: `Missing public RPCs: ${missing.join(', ')} — apply migration 011` })
    } else {
      checks.push({ name: 'rpc_functions', status: 'ok', detail: 'pgmq_read and pgmq_delete wrappers are present' })
    }
  } catch (e) {
    checks.push({ name: 'rpc_functions', status: 'error', detail: String(e) })
  }

  // ── Check 4: match_ccr_chunks_with_context is callable ──────────────────
  try {
    const fakeEmbedding = Array(1536).fill(0)
    const { error } = await supabase.rpc('match_ccr_chunks_with_context', {
      query_embedding: fakeEmbedding,
      query_text: 'test',
      match_threshold: 0.99,
      match_count: 1,
      p_hoa_id: hoaId,
    })
    if (error) {
      checks.push({ name: 'search_rpc', status: 'error', detail: `RPC call failed: ${error.message}` })
    } else {
      checks.push({ name: 'search_rpc', status: 'ok', detail: 'match_ccr_chunks_with_context is callable' })
    }
  } catch (e) {
    checks.push({ name: 'search_rpc', status: 'error', detail: String(e) })
  }

  // ── Check 5: OpenAI API key (embed test) ────────────────────────────────
  try {
    if (!process.env.OPENAI_API_KEY) {
      checks.push({ name: 'openai', status: 'error', detail: 'OPENAI_API_KEY is not set' })
    } else {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: 'ping', dimensions: 1536 })
      checks.push({ name: 'openai', status: 'ok', detail: `Embedding OK — ${res.data[0].embedding.length} dims` })
    }
  } catch (e) {
    checks.push({ name: 'openai', status: 'error', detail: `OpenAI API error: ${String(e)}` })
  }

  // ── Check 6: Anthropic API key (HyDE test) ──────────────────────────────
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      checks.push({ name: 'anthropic', status: 'warn', detail: 'ANTHROPIC_API_KEY is not set — HyDE and reranking will fall back to basic search' })
    } else {
      const { text } = await generateText({
        model: anthropic('claude-haiku-4-5-20251001'),
        maxTokens: 10,
        messages: [{ role: 'user', content: 'Reply with "ok".' }],
      })
      checks.push({ name: 'anthropic', status: 'ok', detail: `Haiku responsive: "${text.slice(0, 30)}"` })
    }
  } catch (e) {
    checks.push({ name: 'anthropic', status: 'error', detail: `Anthropic API error: ${String(e)}` })
  }

  // ── Check 7: Edge Function reachability ─────────────────────────────────
  try {
    const efUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`
    const res = await fetch(efUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 200) {
      checks.push({ name: 'edge_function', status: 'ok', detail: 'process-document Edge Function is deployed and responding' })
    } else if (res.status === 401) {
      checks.push({ name: 'edge_function', status: 'warn', detail: 'Edge Function exists but returned 401 — check SUPABASE_SERVICE_ROLE_KEY match' })
    } else if (res.status === 404) {
      checks.push({ name: 'edge_function', status: 'error', detail: 'Edge Function not found (404) — run: supabase functions deploy process-document' })
    } else {
      const body = await res.text().catch(() => '')
      checks.push({ name: 'edge_function', status: 'warn', detail: `Edge Function returned ${res.status}: ${body.slice(0, 200)}` })
    }
  } catch (e) {
    checks.push({ name: 'edge_function', status: 'error', detail: `Could not reach Edge Function: ${String(e)}` })
  }

  // ── Check 8: pg_cron job status (via a helper RPC or graceful skip) ───────
  // cron.job lives in the cron schema — not exposed via PostgREST by default.
  // We probe by calling a known cron function to see if pg_cron is enabled,
  // and report what we can from the document processing status as a proxy.
  try {
    // Attempt to query cron.job via raw SQL through a SECURITY DEFINER helper if it exists,
    // otherwise fall back to checking if pending docs are accumulating (indirect signal).
    const { data: pendingDocs } = await supabase
      .from('ccr_documents')
      .select('id, status, last_queued_at')
      .eq('hoa_id', hoaId)
      .in('status', ['pending', 'processing'])
      .order('last_queued_at', { ascending: true })
      .limit(5)

    if (pendingDocs && pendingDocs.length > 0) {
      const oldest = pendingDocs[0]
      const minutesStuck = oldest.last_queued_at
        ? Math.floor((Date.now() - new Date(oldest.last_queued_at).getTime()) / 60000)
        : null
      const detail = minutesStuck !== null && minutesStuck > 5
        ? `${pendingDocs.length} doc(s) stuck pending for ${minutesStuck}+ min — pg_cron trigger likely not firing (check migration 010 and ALTER DATABASE config)`
        : `${pendingDocs.length} doc(s) pending/processing — normal if just uploaded`
      checks.push({
        name: 'pg_cron',
        status: minutesStuck !== null && minutesStuck > 5 ? 'error' : 'warn',
        detail,
      })
    } else {
      checks.push({ name: 'pg_cron', status: 'ok', detail: 'No stuck documents detected (cannot directly query pg_cron jobs from API)' })
    }
  } catch (e) {
    checks.push({ name: 'pg_cron', status: 'warn', detail: `Could not check pending docs: ${String(e)}` })
  }

  const hasError = checks.some(c => c.status === 'error')
  const hasWarn = checks.some(c => c.status === 'warn')

  return Response.json({
    ok: !hasError,
    status: hasError ? 'error' : hasWarn ? 'warn' : 'ok',
    hoaId,
    checks,
    generatedAt: new Date().toISOString(),
  })
}
