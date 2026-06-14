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

  const isDemo = user.email === 'demo@hoa-portal.app'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar profile={profile} hoaName={hoa?.name ?? 'HOA Portal'} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isDemo && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
            Você está visualizando uma <strong>demonstração ao vivo</strong> do HOA Portal.{' '}
            <a href="/register" className="underline font-medium hover:text-amber-900">
              Crie seu condomínio →
            </a>
          </div>
        )}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
