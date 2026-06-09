import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/portal/sections/NavBar'
import { HeroSection } from '@/components/portal/sections/HeroSection'
import { ExperienceSection } from '@/components/portal/sections/ExperienceSection'
import { CommunityInfoSection } from '@/components/portal/sections/CommunityInfoSection'
import { AmenitiesSection } from '@/components/portal/sections/AmenitiesSection'
import { LocationSection } from '@/components/portal/sections/LocationSection'
import { ResidentSection } from '@/components/portal/sections/ResidentSection'
import { ContactSection } from '@/components/portal/sections/ContactSection'
import { LandingFooter } from '@/components/portal/sections/LandingFooter'

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
    title: `${hoa.name} — Community Portal`,
    description: `Welcome to ${hoa.name}. Where Florida charm meets the waterfront lifestyle.`,
  }
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name, subdomain')
    .eq('subdomain', slug)
    .single()

  if (!hoa) notFound()

  return (
    <>
      <NavBar hoaName={hoa.name} />
      <HeroSection />
      <ExperienceSection />
      <CommunityInfoSection />
      <AmenitiesSection />
      <LocationSection />
      <ResidentSection hoaSlug={hoa.subdomain} />
      <ContactSection />
      <LandingFooter />
    </>
  )
}
