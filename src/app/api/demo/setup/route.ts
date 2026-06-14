import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const DEMO_HOA_ID   = '00000000-0000-0000-0000-000000000001'
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002'
const DEMO_RES_1_ID = '00000000-0000-0000-0000-000000000003'
const DEMO_RES_2_ID = '00000000-0000-0000-0000-000000000004'
const DEMO_RES_3_ID = '00000000-0000-0000-0000-000000000005'
const DEMO_EMAIL    = 'demo@hoa-portal.app'
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo-password'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.DEMO_SETUP_SECRET || secret !== process.env.DEMO_SETUP_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createServiceClient()
  const result: Record<string, string> = {}

  // 1. Create demo admin auth user (idempotent)
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    id: DEMO_ADMIN_ID,
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

  // 3. Upsert demo admin profile — always overwrite to correct role if previously 'resident'
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: DEMO_ADMIN_ID,
        hoa_id: DEMO_HOA_ID,
        role: 'admin',
        full_name: 'Demo Admin',
        email: DEMO_EMAIL,
        is_active: true,
      },
      { onConflict: 'id' }
    )
  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 })
  }
  result.profile = 'ok'

  // 4. Create demo resident auth users (data anchors for seed records)
  const demoResidents = [
    { id: DEMO_RES_1_ID, email: 'demo-res1@hoa-portal.app', full_name: 'Maria Santos',  unit_number: '204' },
    { id: DEMO_RES_2_ID, email: 'demo-res2@hoa-portal.app', full_name: 'James Carter',  unit_number: '312' },
    { id: DEMO_RES_3_ID, email: 'demo-res3@hoa-portal.app', full_name: 'Linda Park',    unit_number: '108' },
  ]
  for (const res of demoResidents) {
    const { error: resErr } = await supabase.auth.admin.createUser({
      id: res.id, email: res.email, password: 'demo-resident-placeholder-9x!', email_confirm: true,
    })
    if (resErr && !resErr.message.includes('already been registered')) {
      return NextResponse.json({ ok: false, error: resErr.message }, { status: 500 })
    }
    await supabase.from('profiles').upsert(
      { id: res.id, hoa_id: DEMO_HOA_ID, role: 'resident', full_name: res.full_name, unit_number: res.unit_number, email: res.email, is_active: true },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  }
  result.residents = 'ok'

  // 5. Amenity
  await supabase.from('amenities').upsert(
    {
      id: '00000000-0000-0000-0000-000000000010',
      hoa_id: DEMO_HOA_ID,
      name: 'Community Clubhouse',
      description: 'Main gathering space with kitchen and event area. Seats up to 50 guests.',
      capacity: 50,
      rules: 'Must be vacated by 10pm. No outside catering without prior approval.',
      is_active: true,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  result.amenity = 'ok'

  // 6. Work Orders
  const workOrders: Array<{ id: string; hoa_id: string; submitted_by: string; title: string; description: string; status: string; priority: string; admin_notes: string | null }> = [
    {
      id: '00000000-0000-0000-0000-000000000020',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_1_ID,
      title: 'Pool pump making unusual noise',
      description: 'The main pool pump has been making a loud grinding noise since Monday morning. It seems to be running but the sound is concerning — may need inspection.',
      status: 'open', priority: 'high', admin_notes: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_2_ID,
      title: 'Parking lot lights out — spots 12–15',
      description: 'Three overhead lights in the east parking section have been out for over a week. Residents are having difficulty navigating at night.',
      status: 'in_progress', priority: 'medium',
      admin_notes: 'Electrician scheduled for Thursday. Replacement parts already ordered.',
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_3_ID,
      title: 'Broken gate latch on east entrance',
      description: 'The security gate latch on the east entrance is broken and the gate swings open freely. This is a safety concern for the community.',
      status: 'open', priority: 'urgent', admin_notes: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000023',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_1_ID,
      title: 'Lobby carpet stain near elevator',
      description: 'There is a large stain on the lobby carpet near the elevator doors. Reported 3 weeks ago — following up on status.',
      status: 'resolved', priority: 'low',
      admin_notes: 'Professional carpet cleaning completed on June 8th. Stain fully removed.',
    },
  ]
  for (const wo of workOrders) {
    await supabase.from('work_orders').upsert(wo, { onConflict: 'id', ignoreDuplicates: true })
  }
  result.workOrders = 'ok'

  // 7. Complaints
  const complaints: Array<{ id: string; hoa_id: string; submitted_by: string; subject: string; description: string; category: string; status: string; admin_notes: string | null }> = [
    {
      id: '00000000-0000-0000-0000-000000000030',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_1_ID,
      subject: 'Loud music after 11pm — Unit 307',
      description: 'Unit 307 has been playing loud music past 11pm on weekdays for two weeks. Multiple residents have been disturbed. This is a repeated violation of quiet hours.',
      category: 'noise', status: 'under_review',
      admin_notes: 'First written notice sent to resident of Unit 307 on June 10th. Monitoring for further incidents.',
    },
    {
      id: '00000000-0000-0000-0000-000000000031',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_2_ID,
      subject: 'Dog waste not being picked up near pool area',
      description: 'Dog waste is regularly being left near the pool deck and on the main walking path. This is a hygiene issue for all residents and their families.',
      category: 'property', status: 'open', admin_notes: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000032',
      hoa_id: DEMO_HOA_ID, submitted_by: DEMO_RES_3_ID,
      subject: 'Resident blocking reserved parking spot 22',
      description: 'An unregistered vehicle has been blocking my assigned reserved parking spot (Spot 22) on multiple occasions over the last two weeks.',
      category: 'parking', status: 'resolved',
      admin_notes: 'Vehicle owner identified and issued formal warning. No further incidents reported.',
    },
  ]
  for (const c of complaints) {
    await supabase.from('complaints').upsert(c, { onConflict: 'id', ignoreDuplicates: true })
  }
  result.complaints = 'ok'

  // 8. Violations
  const violations: Array<{ id: string; hoa_id: string; reported_by: string; resident_unit: string; description: string; rule_reference: string; status: string; fine_amount: number; formal_notice: string | null; issued_at: string | null }> = [
    {
      id: '00000000-0000-0000-0000-000000000040',
      hoa_id: DEMO_HOA_ID, reported_by: DEMO_ADMIN_ID,
      resident_unit: '204',
      description: 'Unauthorized vehicle parked in designated guest-only zone for 5+ consecutive days.',
      rule_reference: 'CC&R Section 4.3 — Parking Rules',
      status: 'issued', fine_amount: 75,
      formal_notice: 'This notice is to inform you that a vehicle registered to your unit has been parked in the guest-only zone in violation of CC&R Section 4.3. A fine of $75.00 has been assessed. Please ensure the vehicle is relocated immediately to avoid additional fines of $25/day.',
      issued_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000041',
      hoa_id: DEMO_HOA_ID, reported_by: DEMO_ADMIN_ID,
      resident_unit: '312',
      description: 'Unapproved satellite dish installed on exterior balcony railing without architectural committee approval.',
      rule_reference: 'CC&R Section 7.1 — Architectural Modifications',
      status: 'draft', fine_amount: 150, formal_notice: null, issued_at: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000042',
      hoa_id: DEMO_HOA_ID, reported_by: DEMO_ADMIN_ID,
      resident_unit: '108',
      description: 'Holiday decorations left in place past the February 1st community deadline.',
      rule_reference: 'CC&R Section 5.2 — Exterior Decorations',
      status: 'issued', fine_amount: 50,
      formal_notice: 'Your exterior holiday decorations remained in place past the February 1st deadline established by CC&R Section 5.2. A fine of $50.00 has been assessed. Please remove all decorations within 5 business days to avoid further action.',
      issued_at: new Date().toISOString(),
    },
  ]
  for (const v of violations) {
    await supabase.from('violations').upsert(v, { onConflict: 'id', ignoreDuplicates: true })
  }
  result.violations = 'ok'

  // 9. Announcement
  await supabase.from('announcements').upsert(
    {
      id: '00000000-0000-0000-0000-000000000050',
      hoa_id: DEMO_HOA_ID, created_by: DEMO_ADMIN_ID,
      subject: 'Annual HOA Meeting — Save the Date',
      body: 'Dear Sunset Ridge Residents,\n\nPlease join us for our Annual HOA Meeting on Saturday, July 12th at 10:00 AM in the Community Clubhouse.\n\nAgenda items include:\n• 2024–2025 budget review and approval\n• Upcoming landscaping improvements (east courtyard)\n• Pool area renovation proposal\n• Election of one board member\n\nLight refreshments will be provided. Please RSVP to the management office by July 8th.\n\nWe look forward to seeing you there!\n\nThe Sunset Ridge HOA Board',
      status: 'published',
      send_email: true,
      send_sms: false,
      published_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  result.announcement = 'ok'

  return NextResponse.json({
    ok: true,
    created: result,
    next: `Visit ${origin}/demo to access the admin demo`,
  })
}
