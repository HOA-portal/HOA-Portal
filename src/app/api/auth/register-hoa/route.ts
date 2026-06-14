import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function generateSubdomain(hoaName: string): string {
  const base = hoaName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
  const suffix = Math.random().toString(16).slice(2, 6)
  return `${base}-${suffix}`
}

export async function POST(req: NextRequest) {
  const { hoaName, city, state, adminFullName, email, password } = await req.json()

  if (!hoaName || !city || !state || !adminFullName || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const subdomain = generateSubdomain(hoaName)

  // Create the HOA
  const { data: hoa, error: hoaError } = await supabase
    .from('hoas')
    .insert({ name: hoaName.trim(), subdomain, city: city.trim(), state: state.trim() })
    .select('id')
    .single()

  if (hoaError) {
    if (hoaError.code === '23505') {
      return NextResponse.json({ error: 'An HOA with a similar name already exists. Try adding your city name.' }, { status: 409 })
    }
    return NextResponse.json({ error: hoaError.message }, { status: 500 })
  }

  // Create admin auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    await supabase.from('hoas').delete().eq('id', hoa.id)
    const msg = authError?.message ?? 'Account creation failed.'
    if (msg.toLowerCase().includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Create admin profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    hoa_id: hoa.id,
    role: 'admin',
    full_name: adminFullName.trim(),
    email: email.toLowerCase().trim(),
    is_active: true,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('hoas').delete().eq('id', hoa.id)
    return NextResponse.json({ error: 'Profile setup failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
