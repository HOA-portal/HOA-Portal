import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import type { Profile, Hoa } from '@/types/database'
import type { ReactNode } from 'react'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('id', profile.hoa_id)
    .single() as { data: Pick<Hoa, 'name'> | null; error: unknown }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar profile={profile} hoaName={hoa?.name ?? 'HOA Portal'} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
