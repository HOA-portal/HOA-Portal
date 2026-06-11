import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token: string; password: string }

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Use the SECURITY DEFINER function — works without an auth session
  const { data: invitations, error: lookupError } = await supabase
    .rpc('get_invitation_by_token', { p_token: token })

  if (lookupError || !invitations || invitations.length === 0) {
    return NextResponse.json(
      { error: 'This invitation link is invalid, expired, or has already been used.' },
      { status: 400 }
    )
  }

  const invite = invitations[0]

  // Create the auth user
  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name, hoa_id: invite.hoa_id },
  })

  if (createError || !authData.user) {
    const msg = createError?.message ?? 'Account creation failed.'
    // Surface duplicate email clearly
    if (msg.toLowerCase().includes('already')) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Create profile using the new auth user's ID
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    hoa_id: invite.hoa_id,
    role: invite.role,
    full_name: invite.full_name || null,
    unit_number: invite.unit_number || null,
    phone: invite.phone || null,
    email: invite.email.toLowerCase(),
    is_active: true,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Profile setup failed. Please try again.' }, { status: 500 })
  }

  // Mark invitation as accepted
  await supabase
    .from('resident_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('invitation_token', token)

  return NextResponse.json({ ok: true })
}
