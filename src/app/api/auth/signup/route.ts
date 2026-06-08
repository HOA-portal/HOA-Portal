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
  const { email, password, fullName, unitNumber, phone, hoaSubdomain } = await req.json()

  if (!email || !password || !hoaSubdomain) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: hoa, error: hoaError } = await supabase
    .from('hoas')
    .select('id')
    .eq('subdomain', hoaSubdomain.toLowerCase().trim())
    .single()

  if (hoaError || !hoa) {
    return NextResponse.json({ error: 'Community not found. Check the community code and try again.' }, { status: 404 })
  }

  const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, hoa_id: hoa.id },
  })

  if (signUpError || !authData.user) {
    return NextResponse.json({ error: signUpError?.message ?? 'Sign up failed.' }, { status: 400 })
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    hoa_id: hoa.id,
    role: 'resident',
    full_name: fullName || null,
    unit_number: unitNumber || null,
    phone: phone || null,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Profile setup failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
