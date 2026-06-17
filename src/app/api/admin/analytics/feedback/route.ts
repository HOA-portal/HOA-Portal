import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export async function GET() {
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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('metadata')
    .eq('hoa_id', profile.hoa_id)
    .eq('role', 'assistant')
    .gte('created_at', since)
    .not('metadata', 'is', null)

  if (error) {
    return Response.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }

  let helpful = 0
  let notHelpful = 0
  for (const row of (data ?? [])) {
    const meta = row.metadata as Record<string, unknown> | null
    if (meta?.helpful === true) helpful++
    else if (meta?.helpful === false) notHelpful++
  }

  return Response.json({
    helpful,
    notHelpful,
    totalRated: helpful + notHelpful,
  })
}
