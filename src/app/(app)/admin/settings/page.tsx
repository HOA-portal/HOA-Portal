import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CopyButton from '@/components/ui/CopyButton'
import type { Profile } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name, subdomain, city, state')
    .eq('id', profile.hoa_id)
    .single() as { data: { name: string; subdomain: string; city: string | null; state: string } | null; error: unknown }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const signupUrl = `${appUrl}/signup`

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 max-w-2xl">
        <AdminPageHeader
          title="Settings"
          description="Your HOA configuration and community access information."
        />

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Community Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">HOA Name</p>
                <p className="text-sm font-medium text-slate-900">{hoa?.name ?? '—'}</p>
              </div>
              {(hoa?.city || hoa?.state) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Location</p>
                  <p className="text-sm text-slate-900">{[hoa.city, hoa.state].filter(Boolean).join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-blue-900">Resident Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Community Code</p>
                <p className="text-xs text-blue-600 mb-2">Residents enter this code when creating their account at <strong>/signup</strong></p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-white border border-blue-200 px-3 py-2 text-sm font-mono text-slate-900">
                    {hoa?.subdomain ?? '—'}
                  </code>
                  <CopyButton text={hoa?.subdomain ?? ''} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Resident Sign-up Link</p>
                <p className="text-xs text-blue-600 mb-2">Share this link directly with your residents</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-white border border-blue-200 px-3 py-2 text-xs font-mono text-slate-900 truncate">
                    {signupUrl}
                  </code>
                  <CopyButton text={signupUrl} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
