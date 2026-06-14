import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingWizard from './OnboardingWizard'
import type { Profile } from '@/types/database'

export const metadata = { title: 'HOA Portal — Setup' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id, full_name, onboarding_completed')
    .eq('id', user.id)
    .single() as { data: (Pick<Profile, 'role' | 'hoa_id' | 'full_name'> & { onboarding_completed: boolean }) | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')
  if (profile.onboarding_completed) redirect('/admin')

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name, subdomain')
    .eq('id', profile.hoa_id)
    .single() as { data: { name: string; subdomain: string } | null; error: unknown }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <OnboardingWizard
      hoaName={hoa?.name ?? 'Your HOA'}
      subdomain={hoa?.subdomain ?? ''}
      adminName={profile.full_name?.split(' ')[0] ?? 'Admin'}
      appUrl={appUrl}
    />
  )
}
