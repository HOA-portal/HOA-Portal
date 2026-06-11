import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/notifications/email'

interface CsvRow {
  full_name: string
  email: string
  unit_number: string
  phone: string
}

interface ImportResult {
  email: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const emailIdx = header.findIndex((h) => h === 'email')
  if (emailIdx === -1) throw new Error('CSV must have an "email" column')

  const nameIdx = header.findIndex((h) => h.includes('name'))
  const unitIdx = header.findIndex((h) => h.includes('unit') || h.includes('address'))
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('tel'))

  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      // Simple CSV split — handles quoted fields containing commas
      const fields: string[] = []
      let cur = ''
      let inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes }
        else if (ch === ',' && !inQuotes) { fields.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      fields.push(cur.trim())

      return {
        email: (fields[emailIdx] ?? '').replace(/"/g, '').toLowerCase().trim(),
        full_name: nameIdx >= 0 ? (fields[nameIdx] ?? '').replace(/"/g, '').trim() : '',
        unit_number: unitIdx >= 0 ? (fields[unitIdx] ?? '').replace(/"/g, '').trim() : '',
        phone: phoneIdx >= 0 ? (fields[phoneIdx] ?? '').replace(/"/g, '').trim() : '',
      }
    })
    .filter((r) => r.email)
}

function inviteEmailHtml(params: {
  hoaName: string
  fullName: string | null
  inviteUrl: string
}): string {
  const greeting = params.fullName ? `Hi ${params.fullName},` : 'Hi there,'
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <div style="background:#1e40af;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">HOA Portal</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">${params.hoaName}</p>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
        <p style="font-size:16px;margin:0 0 16px">${greeting}</p>
        <p style="margin:0 0 24px;color:#475569">
          Your community is using <strong>HOA Portal</strong> — an AI-powered platform for residents.
          Click below to activate your account and get access to work orders, amenity bookings, community announcements, and more.
        </p>
        <a href="${params.inviteUrl}"
           style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
          Activate my account
        </a>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
          This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  // Verify caller is an authenticated admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('role, hoa_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse request — accepts either multipart/form-data or JSON
  let rows: CsvRow[]
  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
      const text = await file.text()
      rows = parseCSV(text)
    } else {
      const body = await req.json()
      rows = Array.isArray(body.rows) ? body.rows : parseCSV(body.csv ?? '')
    }
  } catch (err) {
    return NextResponse.json({ error: `CSV parse error: ${(err as Error).message}` }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found in the CSV.' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 residents per import.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch HOA info for the invite email
  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('id', profile.hoa_id)
    .single()

  const hoaName = hoa?.name ?? 'Your Community'
  const baseUrl = req.nextUrl.origin

  const results: ImportResult[] = []

  for (const row of rows) {
    if (!row.email) {
      results.push({ email: row.email, status: 'error', reason: 'Missing email' })
      continue
    }

    // Check for existing active profile with this email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('hoa_id', profile.hoa_id)
      .ilike('email', row.email)
      .single()

    if (existingProfile) {
      results.push({ email: row.email, status: 'skipped', reason: 'Already an active resident' })
      continue
    }

    // Emails are always stored lowercase; the unique index on (hoa_id, lower(email))
    // prevents duplicates when the same resident is imported more than once.
    const normalizedEmail = row.email.toLowerCase().trim()

    // Check if a pending invitation already exists to decide between insert and update
    const { data: existing } = await supabase
      .from('resident_invitations')
      .select('id')
      .eq('hoa_id', profile.hoa_id)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .single()

    const invitePayload = {
      hoa_id: profile.hoa_id,
      email: normalizedEmail,
      full_name: row.full_name || null,
      unit_number: row.unit_number || null,
      phone: row.phone || null,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      accepted_at: null,
      external_source: 'csv',
    }

    const query = existing
      ? supabase.from('resident_invitations').update(invitePayload).eq('id', existing.id).select('invitation_token, full_name').single()
      : supabase.from('resident_invitations').insert(invitePayload).select('invitation_token, full_name').single()

    const { data: invite, error: inviteError } = await query

    if (inviteError || !invite) {
      results.push({ email: row.email, status: 'error', reason: inviteError?.message ?? 'DB error' })
      continue
    }

    const inviteUrl = `${baseUrl}/accept-invite/${invite.invitation_token}`
    sendEmail(
      row.email,
      `You're invited to ${hoaName} on HOA Portal`,
      inviteEmailHtml({ hoaName, fullName: invite.full_name, inviteUrl })
    )

    results.push({ email: row.email, status: 'created' })
  }

  const created = results.filter((r) => r.status === 'created').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  return NextResponse.json({ ok: true, created, skipped, errors, results })
}
