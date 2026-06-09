import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HoaPortalHero } from '@/components/portal/HoaPortalHero'
import { LoginCard } from '@/components/portal/LoginCard'
import { PortalFooter } from '@/components/portal/PortalFooter'

interface PortalPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PortalPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('subdomain', slug)
    .single()

  if (!hoa) return { title: 'Community Portal' }

  return {
    title: `${hoa.name} — Resident Portal`,
    description: `Sign in to ${hoa.name} community portal`,
  }
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name, address, city, state, phone, website, logo_url')
    .eq('subdomain', slug)
    .single()

  if (!hoa) notFound()

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm">
        <HoaPortalHero
          name={hoa.name}
          city={hoa.city}
          state={hoa.state}
        />

        <LoginCard hoaSlug={slug} />

        <PortalFooter
          address={hoa.address}
          phone={hoa.phone}
          website={hoa.website}
        />
      </div>
    </div>
  )
}
