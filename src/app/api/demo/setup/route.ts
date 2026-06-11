import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const DEMO_HOA_ID  = '00000000-0000-0000-0000-000000000001'
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_EMAIL   = 'demo@hoa-portal.app'
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo-password'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.DEMO_SETUP_SECRET || secret !== process.env.DEMO_SETUP_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createServiceClient()
  const result: Record<string, string> = {}

  // 1. Create demo auth user (idempotent — ignore if already exists)
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })

  if (userError && !userError.message.includes('already been registered')) {
    return NextResponse.json({ ok: false, error: userError.message }, { status: 500 })
  }
  result.user = userData?.user ? 'created' : 'already_exists'

  // 2. Create demo HOA (idempotent)
  const { error: hoaError } = await supabase
    .from('hoas')
    .upsert(
      { id: DEMO_HOA_ID, name: 'Sunset Ridge HOA', subdomain: 'sunset-ridge-demo', city: 'Orlando', state: 'FL' },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (hoaError) {
    return NextResponse.json({ ok: false, error: hoaError.message }, { status: 500 })
  }
  result.hoa = 'ok'

  // 3. Create demo profile (idempotent)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: DEMO_USER_ID,
        hoa_id: DEMO_HOA_ID,
        role: 'resident',
        full_name: 'Demo Resident',
        unit_number: '101',
        email: DEMO_EMAIL,
        is_active: true,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })
  }
  result.profile = 'ok'

  return NextResponse.json({
    ok: true,
    created: result,
    next: `Visit ${origin}/demo to verify the demo works`,
  })
}
