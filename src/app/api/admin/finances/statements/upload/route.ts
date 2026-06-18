import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseFinancialStatementPDF } from '@/lib/ai/financial-parser'
import type { Profile } from '@/types/database'

export const maxDuration = 60

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

function isPdf(header: Uint8Array): boolean {
  return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46
}

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File exceeds 20 MB limit' }, { status: 413 })
  }

  const headerBytes = await file.slice(0, 4).arrayBuffer()
  if (!isPdf(new Uint8Array(headerBytes))) {
    return Response.json({ error: 'Only PDF files are accepted' }, { status: 415 })
  }

  const hoaId = profile.hoa_id
  const storagePath = `${hoaId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  let { error: storageError } = await supabase.storage
    .from('financial-statements')
    .upload(storagePath, file)

  // Bucket may not exist yet (migration not applied, or remote project without manual setup).
  // Auto-create it with the service role and retry once.
  if (storageError && /bucket not found/i.test(storageError.message)) {
    const serviceClient = await createServiceClient()
    const { error: bucketErr } = await serviceClient.storage.createBucket('financial-statements', {
      public: false,
      allowedMimeTypes: ['application/pdf'],
    })

    // "already exists" is fine (migration was applied, or race condition)
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      return Response.json({
        error: `Não foi possível criar o bucket de armazenamento: ${bucketErr.message}. Execute "supabase migration up" ou crie o bucket manualmente no Dashboard do Supabase.`,
      }, { status: 500 })
    }

    const retry = await supabase.storage.from('financial-statements').upload(storagePath, file)
    storageError = retry.error ?? null
  }

  if (storageError) {
    return Response.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 })
  }

  const { data: stmt, error: insertError } = await supabase
    .from('financial_statements')
    .insert({
      hoa_id: hoaId,
      filename: file.name,
      storage_path: storagePath,
      uploaded_by: user.id,
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !stmt) {
    await supabase.storage.from('financial-statements').remove([storagePath])
    return Response.json({ error: 'Failed to create statement record' }, { status: 500 })
  }

  try {
    const pdfBuffer = await file.arrayBuffer()
    const parsed = await parseFinancialStatementPDF(pdfBuffer)

    await supabase
      .from('financial_statements')
      .update({
        status: 'review',
        year: parsed.year,
        month: parsed.month,
        parsed_data: parsed as unknown as Record<string, unknown>,
        processed_at: new Date().toISOString(),
      })
      .eq('id', stmt.id)

    return Response.json({ id: stmt.id, status: 'review', parsed }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('financial_statements')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('id', stmt.id)
    return Response.json({ error: `Parsing failed: ${message}` }, { status: 422 })
  }
}
