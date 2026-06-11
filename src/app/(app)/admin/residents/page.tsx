import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/StatusBadge'
import type { Profile } from '@/types/database'

interface ResidentRow {
  id: string
  email: string | null
  full_name: string | null
  unit_number: string | null
  phone: string | null
  status: 'active' | 'inactive' | 'invited'
  created_at: string
  source: 'account' | 'invitation'
}

async function getResidents(hoaId: string): Promise<ResidentRow[]> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [profilesResult, invitesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, unit_number, phone, is_active, created_at')
      .eq('hoa_id', hoaId)
      .eq('role', 'resident')
      .order('created_at', { ascending: false }),
    supabase
      .from('resident_invitations')
      .select('id, email, full_name, unit_number, phone, invited_at')
      .eq('hoa_id', hoaId)
      .is('accepted_at', null)
      .order('invited_at', { ascending: false }),
  ])

  const profileRows: ResidentRow[] = (profilesResult.data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    unit_number: p.unit_number,
    phone: p.phone,
    status: p.is_active ? 'active' : 'inactive',
    created_at: p.created_at,
    source: 'account',
  }))

  const inviteRows: ResidentRow[] = (invitesResult.data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    full_name: i.full_name,
    unit_number: i.unit_number,
    phone: i.phone,
    status: 'invited',
    created_at: i.invited_at,
    source: 'invitation',
  }))

  return [...inviteRows, ...profileRows]
}

export default async function ResidentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const residents = await getResidents(profile.hoa_id)

  const counts = {
    active: residents.filter((r) => r.status === 'active').length,
    invited: residents.filter((r) => r.status === 'invited').length,
    inactive: residents.filter((r) => r.status === 'inactive').length,
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Residents"
          description="Manage residents and invite new members via CSV import."
          action={
            <Link href="/admin/residents/import">
              <Button size="sm">Import CSV</Button>
            </Link>
          }
        />

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active', value: counts.active, color: 'text-green-700' },
            { label: 'Invited (pending)', value: counts.invited, color: 'text-amber-700' },
            { label: 'Inactive', value: counts.inactive, color: 'text-slate-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-lg px-5 py-4">
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              <p className={`text-sm font-medium mt-0.5 ${stat.color}`}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Residents table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {residents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No residents yet.{' '}
                    <Link href="/admin/residents/import" className="text-primary underline underline-offset-2">
                      Import from CSV
                    </Link>{' '}
                    to get started.
                  </td>
                </tr>
              )}
              {residents.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.full_name ?? <span className="text-slate-400 font-normal italic">No name</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.unit_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
