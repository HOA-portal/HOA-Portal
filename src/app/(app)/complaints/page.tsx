import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { ComplaintsList } from '@/components/resident/complaints/ComplaintsList'
import type { Profile } from '@/types/database'

export default async function ResidentComplaintsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'resident') redirect('/admin')

  const { data: complaints } = await supabase
    .from('complaints')
    .select('id, subject, description, category, status, admin_notes, evidence_urls, created_at, updated_at')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="My Complaints"
          description="Track the status of your submitted complaints."
        />
        <ComplaintsList complaints={complaints ?? []} />
      </div>
    </div>
  )
}
