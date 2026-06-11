import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/notifications/email'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  const supabase = createServiceClient()

  // Refresh token and extend expiry
  const newToken = crypto.randomUUID()
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error } = await supabase
    .from('resident_invitations')
    .update({ invitation_token: newToken, expires_at: newExpiry, invited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hoa_id', adminProfile.hoa_id)
    .is('accepted_at', null)
    .select('email, full_name, invitation_token')
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invitation not found or already accepted.' }, { status: 404 })
  }

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('id', adminProfile.hoa_id)
    .single()

  const hoaName = hoa?.name ?? 'Your Community'
  const baseUrl = req.nextUrl.origin
  const inviteUrl = `${baseUrl}/accept-invite/${invite.invitation_token}`

  const greeting = invite.full_name ? `Hi ${invite.full_name},` : 'Hi there,'
  sendEmail(
    invite.email,
    `Reminder: You're invited to ${hoaName} on HOA Portal`,
    `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
        <div style="background:#1e40af;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">HOA Portal</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">${hoaName}</p>
        </div>
        <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
          <p style="font-size:16px;margin:0 0 16px">${greeting}</p>
          <p style="margin:0 0 24px;color:#475569">
            This is a reminder that you have a pending invitation to <strong>${hoaName}</strong> on HOA Portal.
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;background:#1e40af;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
            Activate my account
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
            This invitation expires in 7 days.
          </p>
        </div>
      </div>
    `
  )

  return NextResponse.json({ ok: true })
}
