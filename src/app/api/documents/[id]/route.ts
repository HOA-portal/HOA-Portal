import { createClient } from '@/lib/supabase/server'
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
