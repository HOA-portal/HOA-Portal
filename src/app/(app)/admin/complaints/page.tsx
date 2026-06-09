import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { ComplaintsTable } from '@/components/admin/complaints/ComplaintsTable'
import type { Profile } from '@/types/database'

export default async function ComplaintsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const { data: complaints } = await supabase
    .from('complaints')
    .select(`
      id, subject, description, category, status,
      admin_notes, evidence_urls, created_at,
      profiles!complaints_submitted_by_fkey (full_name, unit_number)
    `)
    .eq('hoa_id', profile.hoa_id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Complaints"
          description="Review and respond to resident complaints."
        />
        <ComplaintsTable complaints={(complaints ?? []) as never} />
      </div>
    </div>
  )
}
