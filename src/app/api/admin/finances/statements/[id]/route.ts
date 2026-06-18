import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile || profile.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data: stmt, error } = await supabase
    .from('financial_statements')
    .select('*')
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .single()

  if (error || !stmt) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(stmt)
}
