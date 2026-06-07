import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (!profile) redirect('/login')

  // Route based on role
  if (profile.role === 'admin') {
    redirect('/admin')
  } else {
    redirect('/chat')
  }
}
