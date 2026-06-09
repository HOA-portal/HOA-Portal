import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { ViolationsTable } from '@/components/admin/violations/ViolationsTable'
import type { Profile } from '@/types/database'

export default async function ViolationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const { data: violations } = await supabase
    .from('violations')
    .select('id, description, resident_unit, status, rule_reference, fine_amount, formal_notice, photo_urls, issued_at, created_at')
    .eq('hoa_id', profile.hoa_id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Violations"
          description="Manage violation notices and issue formal warnings."
        />
        <ViolationsTable violations={(violations ?? []) as never} />
      </div>
    </div>
  )
}
