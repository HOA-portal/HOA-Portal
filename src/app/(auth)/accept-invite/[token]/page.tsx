import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AcceptInviteForm } from './AcceptInviteForm'

interface InviteData {
  id: string
  email: string
  full_name: string | null
  unit_number: string | null
  phone: string | null
  hoa_name: string
  hoa_subdomain: string
}

async function getInvitation(token: string): Promise<InviteData | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token })
  if (error || !data || data.length === 0) return null
  return data[0] as InviteData
}

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getInvitation(token)

  if (!invite) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">H</span>
            </div>
            <span className="font-semibold text-lg">HOA Portal</span>
          </div>
          <CardTitle className="text-2xl">Invitation not found</CardTitle>
          <CardDescription>
            This invitation link is invalid, expired, or has already been used.
            Contact your HOA administrator to request a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">H</span>
          </div>
          <span className="font-semibold text-lg">HOA Portal</span>
        </div>
        <CardTitle className="text-2xl">Activate your account</CardTitle>
        <CardDescription>
          You&apos;ve been invited to <strong>{invite.hoa_name}</strong>. Choose a password to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm token={token} invite={invite} />
      </CardContent>
    </Card>
  )
}
