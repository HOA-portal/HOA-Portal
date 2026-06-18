import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export async function DELETE(request: Request): Promise<Response> {
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

  const { error } = await supabase
    .from('ccr_dlq')
    .delete()
    .eq('id', dlqId)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
