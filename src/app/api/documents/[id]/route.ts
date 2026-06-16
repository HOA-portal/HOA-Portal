import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

// GET /api/documents/[id] — poll document processing status
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS ensures the document belongs to the caller's HOA
  const { data: doc, error } = await supabase
    .from('ccr_documents')
    .select('id, filename, status, page_count, chunk_count, error_message, processed_at, created_at')
    .eq('id', id)
    .single()

  if (error || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  return Response.json(doc)
}

// DELETE /api/documents/[id] — remove document and all its chunks
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RLS guarantees doc belongs to caller's HOA; check status before deletion
  const { data: doc, error: fetchError } = await supabase
    .from('ccr_documents')
    .select('id, storage_path, status')
    .eq('id', id)
    .single()

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.status === 'processing') {
    return Response.json(
      { error: 'Cannot delete a document while it is being processed' },
      { status: 409 }
    )
  }

  // Remove from Storage (best-effort; proceed even if file already gone)
  await supabase.storage.from('ccr-documents').remove([doc.storage_path])

  // Delete document row — cascades to ccr_chunks via FK
  const { error: deleteError } = await supabase
    .from('ccr_documents')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return Response.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}

// POST /api/documents/[id] — retry a failed document (re-enqueue without re-upload)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: doc, error: fetchError } = await supabase
    .from('ccr_documents')
    .select('id, storage_path, status, hoa_id, chunk_count')
    .eq('id', id)
    .single()

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  const isEmptyCompleted = doc.status === 'completed' && ((doc.chunk_count ?? 0) === 0)
  if (doc.status !== 'failed' && !isEmptyCompleted) {
    return Response.json(
      { error: 'Only failed documents or completed documents with 0 chunks can be retried' },
      { status: 409 }
    )
  }

  // Delete any partial chunks from the failed run to avoid duplicates
  await supabase.from('ccr_chunks').delete().eq('document_id', id)

  // Reset document status before re-enqueuing.
  // last_queued_at must be refreshed so fail_stale_documents() doesn't immediately
  // re-fail the document (it checks last_queued_at < now() - 10min, not created_at).
  const { error: updateError } = await supabase
    .from('ccr_documents')
    .update({
      status: 'pending',
      error_message: null,
      processed_at: null,
      chunk_count: null,
      last_queued_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return Response.json({ error: 'Failed to reset document status' }, { status: 500 })
  }

  // Re-enqueue with service role (pgmq bypasses RLS)
  const serviceClient = await createServiceClient()
  const { error: enqueueError } = await serviceClient.rpc('enqueue_document_processing', {
    p_document_id: id,
    p_hoa_id: doc.hoa_id,
    p_storage_path: doc.storage_path,
  })

  if (enqueueError) {
    console.error('[documents/retry] Enqueue failed:', enqueueError)
  }

  // Fire-and-forget: Edge Function (primary) + internal route (fallback)
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`
  fetch(edgeFnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: '{}',
  }).catch(() => {})

  const appOrigin = new URL(_request.url).origin
  fetch(`${appOrigin}/api/admin/documents/process`, {
    method: 'POST',
    headers: { Cookie: _request.headers.get('cookie') ?? '' },
  }).catch(() => {})

  return Response.json({ documentId: id, status: 'pending' }, { status: 202 })
}
