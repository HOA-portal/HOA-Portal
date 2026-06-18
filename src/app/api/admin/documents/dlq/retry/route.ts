import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export async function POST(request: Request): Promise<Response> {
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

  let dlqId: number
  try {
    const body = await request.json() as { dlqId?: number }
    if (typeof body.dlqId !== 'number') throw new Error('missing dlqId')
    dlqId = body.dlqId
  } catch {
    return Response.json({ error: 'Invalid request body — expected { dlqId: number }' }, { status: 400 })
  }

  // Fetch DLQ row (RLS ensures it belongs to this admin's HOA)
  const { data: dlqRow, error: dlqErr } = await supabase
    .from('ccr_dlq')
    .select('id, document_id, raw_message')
    .eq('id', dlqId)
    .single()

  if (dlqErr || !dlqRow) {
    return Response.json({ error: 'DLQ entry not found' }, { status: 404 })
  }

  // Fetch document storage_path needed for re-enqueue
  const { data: doc, error: docErr } = await supabase
    .from('ccr_documents')
    .select('id, storage_path')
    .eq('id', dlqRow.document_id)
    .single()

  if (docErr || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  // Reset document state so processing workers can claim it again
  await supabase
    .from('ccr_documents')
    .update({ status: 'pending', error_message: null, progress_pct: 0 })
    .eq('id', dlqRow.document_id)

  // Re-enqueue for processing
  const { error: enqueueErr } = await supabase.rpc('enqueue_document_processing', {
    p_document_id: dlqRow.document_id,
    p_hoa_id: profile.hoa_id,
    p_storage_path: doc.storage_path,
  })

  if (enqueueErr) {
    return Response.json({ error: `Enqueue failed: ${enqueueErr.message}` }, { status: 500 })
  }

  // Mark retried (preserve audit trail — do not delete)
  await supabase
    .from('ccr_dlq')
    .update({ retried_at: new Date().toISOString() })
    .eq('id', dlqId)

  return Response.json({ ok: true, documentId: dlqRow.document_id })
}
