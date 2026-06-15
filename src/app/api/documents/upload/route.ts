import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export const maxDuration = 60

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// Magic byte signatures for accepted file types
function isValidFileMagic(header: Uint8Array): boolean {
  // PDF: %PDF
  if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) return true
  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return true
  return false
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()

  // Auth gate
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

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File exceeds 50 MB limit' }, { status: 413 })
  }

  // Magic bytes check (validate actual file content, not just Content-Type header)
  const headerBytes = await file.slice(0, 10).arrayBuffer()
  if (!isValidFileMagic(new Uint8Array(headerBytes))) {
    return Response.json({ error: 'Only PDF and image files are accepted' }, { status: 415 })
  }

  const hoaId = profile.hoa_id

  // Rate limit: max 10 uploads per HOA per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('ccr_documents')
    .select('*', { count: 'exact', head: true })
    .eq('hoa_id', hoaId)
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= 10) {
    return Response.json(
      { error: 'Upload limit reached. Maximum 10 documents per hour per community.' },
      { status: 429 }
    )
  }

  // Duplicate detection: warn if a document with the same filename already exists
  const { data: existing } = await supabase
    .from('ccr_documents')
    .select('id, status')
    .eq('hoa_id', hoaId)
    .eq('filename', file.name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const storagePath = `${hoaId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // Upload to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('ccr-documents')
    .upload(storagePath, file)

  if (storageError) {
    return Response.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 }
    )
  }

  // Insert document record (status defaults to 'pending' via DB default)
  const { data: doc, error: insertError } = await supabase
    .from('ccr_documents')
    .insert({
      hoa_id: hoaId,
      filename: file.name,
      storage_path: storagePath,
      uploaded_by: user.id,
      last_queued_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !doc) {
    // Best-effort cleanup of the storage object
    await supabase.storage.from('ccr-documents').remove([storagePath])
    return Response.json({ error: 'Failed to create document record' }, { status: 500 })
  }

  // Enqueue with service role (pgmq schema bypasses user RLS)
  const serviceClient = await createServiceClient()
  const { error: enqueueError } = await serviceClient.rpc('enqueue_document_processing', {
    p_document_id: doc.id,
    p_hoa_id: hoaId,
    p_storage_path: storagePath,
  })

  if (enqueueError) {
    console.error('[documents/upload] Enqueue failed:', enqueueError)
    // Non-fatal: document is uploaded, admin can retry via UI
  }

  // Fire-and-forget: try Edge Function first, then fall back to the internal processing route.
  // Belt-and-suspenders: the first worker to claim the document (via optimistic lock) wins;
  // the other worker gets a "no pending documents" response and exits cleanly.
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-document`
  fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: '{}',
  }).catch((err) => {
    console.error('[documents/upload] Edge Function trigger failed:', err)
  })

  // Fallback: also trigger the internal Next.js processing route.
  // Works even if the Edge Function is not deployed or pg_cron is not configured.
  const appOrigin = new URL(request.url).origin
  fetch(`${appOrigin}/api/admin/documents/process`, {
    method: 'POST',
    headers: { Cookie: request.headers.get('cookie') ?? '' },
  }).catch((err) => {
    console.error('[documents/upload] Internal processing fallback failed:', err)
  })

  return Response.json({
    documentId: doc.id,
    status: 'pending',
    ...(existing ? { duplicateWarning: true, existingDocumentId: existing.id } : {}),
  }, { status: 202 })
}
