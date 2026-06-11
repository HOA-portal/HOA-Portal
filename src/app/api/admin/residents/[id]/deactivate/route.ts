import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/admin/residents/[id]/deactivate
// Body: { active: boolean } — false to deactivate, true to reactivate
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { active } = await req.json() as { active: boolean }

  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await serverSupabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent admins from deactivating themselves
  if (id === user.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: target, error } = await supabase
    .from('profiles')
    .update({ is_active: active })
    .eq('id', id)
    .eq('hoa_id', adminProfile.hoa_id)
    .select('id, role')
    .single()

  if (error || !target) {
    return NextResponse.json({ error: 'Resident not found.' }, { status: 404 })
  }

  // Invalidate all active sessions so the user is immediately locked out
  if (!active) {
    await supabase.auth.admin.signOut(id, 'global')
  }

  return NextResponse.json({ ok: true, is_active: active })
}
