import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const CONTENT_PREVIEW_LENGTH = 300

// GET /api/documents/[id]/chunks — list ingested chunks for a completed document
export async function GET(
  request: Request,
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

  // RLS ensures document belongs to caller's HOA
  const { data: doc, error: docError } = await supabase
    .from('ccr_documents')
    .select('id, status')
    .eq('id', id)
    .single()

  if (docError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.status !== 'completed') {
    return Response.json(
      { error: 'Chunks are only available for completed documents' },
      { status: 409 }
    )
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)))
  const offset = (page - 1) * limit

  const { data: chunks, error: chunksError, count } = await supabase
    .from('ccr_chunks')
    .select('id, chunk_index, section_title, content, metadata', { count: 'exact' })
    .eq('document_id', id)
    .order('chunk_index', { ascending: true })
    .range(offset, offset + limit - 1)

  if (chunksError) {
    return Response.json({ error: 'Failed to fetch chunks' }, { status: 500 })
  }

  const items = (chunks ?? []).map(c => ({
    id: c.id,
    chunk_index: c.chunk_index,
    section_title: c.section_title,
    content_preview: c.content.length > CONTENT_PREVIEW_LENGTH
      ? c.content.slice(0, CONTENT_PREVIEW_LENGTH) + '…'
      : c.content,
    content_length: c.content.length,
    hierarchy_path: (c.metadata as Record<string, unknown>)?.hierarchy_path ?? null,
    metadata: c.metadata,
  }))

  return Response.json({
    items,
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  })
}
