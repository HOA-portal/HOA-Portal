import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { WorkOrdersList } from '@/components/resident/work-orders/WorkOrdersList'
import type { Profile } from '@/types/database'

export default async function ResidentWorkOrdersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'resident') redirect('/admin')

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id, title, description, status, priority, photo_urls, admin_notes, created_at, updated_at')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="My Work Orders"
          description="Track the status of your maintenance requests."
        />
        <WorkOrdersList workOrders={workOrders ?? []} />
      </div>
    </div>
  )
}
