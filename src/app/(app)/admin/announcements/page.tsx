import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AnnouncementsList } from '@/components/admin/announcements/AnnouncementsList'
import type { Profile } from '@/types/database'

export default async function AnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, subject, body, status, send_email, send_sms, published_at, created_at, updated_at')
    .eq('hoa_id', profile.hoa_id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Announcements"
          description="Draft and publish community-wide announcements."
        />
        <AnnouncementsList announcements={(announcements ?? []) as never} />
      </div>
    </div>
  )
}
