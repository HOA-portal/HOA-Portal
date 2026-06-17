import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'hoa_id'> | null; error: unknown }

  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  let body: { helpful?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.helpful !== 'boolean') {
    return Response.json({ error: 'helpful must be a boolean' }, { status: 400 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('chat_messages')
    .update({
      metadata: { helpful: body.helpful } as Record<string, unknown>,
    })
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .eq('role', 'assistant')

  if (error) {
    return Response.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
