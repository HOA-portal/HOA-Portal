import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AnnouncementsFeed } from '@/components/resident/announcements/AnnouncementsFeed'
import type { Profile } from '@/types/database'

export default async function ResidentAnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'resident') redirect('/admin')

  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, subject, body, published_at, created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Announcements"
          description="Community updates from your HOA."
        />
        <AnnouncementsFeed announcements={announcements ?? []} />
      </div>
    </div>
  )
}
