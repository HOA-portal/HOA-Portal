import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { WorkOrdersTable } from '@/components/admin/work-orders/WorkOrdersTable'
import type { Profile } from '@/types/database'

export default async function WorkOrdersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select(`
      id, title, description, status, priority,
      photo_urls, admin_notes, created_at, updated_at,
      profiles!work_orders_submitted_by_fkey (full_name, unit_number)
    `)
    .eq('hoa_id', profile.hoa_id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Work Orders"
          description="Review and manage maintenance requests from residents."
        />
        <WorkOrdersTable workOrders={(workOrders ?? []) as never} />
      </div>
    </div>
  )
}
