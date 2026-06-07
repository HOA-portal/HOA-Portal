import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wrench, ClipboardList, ShieldAlert, Megaphone } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types/database'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id, full_name')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id' | 'full_name'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const hoaId = profile.hoa_id

  // Load counts in parallel
  const [workOrdersRes, complaintsRes, violationsRes, announcementsRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)
      .in('status', ['open', 'under_review']),
    supabase
      .from('violations')
      .select('id', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)
      .in('status', ['draft', 'issued']),
    supabase
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)
      .eq('status', 'draft'),
  ])

  // Load recent work orders
  const { data: recentWorkOrders } = await supabase
    .from('work_orders')
    .select('id, title, status, priority, created_at')
    .eq('hoa_id', hoaId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5) as { data: Array<{ id: string; title: string; status: string; priority: string; created_at: string }> | null; error: unknown }

  // Load recent complaints
  const { data: recentComplaints } = await supabase
    .from('complaints')
    .select('id, subject, category, status, created_at')
    .eq('hoa_id', hoaId)
    .in('status', ['open', 'under_review'])
    .order('created_at', { ascending: false })
    .limit(5) as { data: Array<{ id: string; subject: string; category: string; status: string; created_at: string }> | null; error: unknown }

  const stats = [
    {
      label: 'Open Work Orders',
      value: workOrdersRes.count ?? 0,
      icon: Wrench,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/admin/work-orders',
    },
    {
      label: 'Open Complaints',
      value: complaintsRes.count ?? 0,
      icon: ClipboardList,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/admin/complaints',
    },
    {
      label: 'Active Violations',
      value: violationsRes.count ?? 0,
      icon: ShieldAlert,
      color: 'text-red-600',
      bg: 'bg-red-50',
      href: '/admin/violations',
    },
    {
      label: 'Draft Announcements',
      value: announcementsRes.count ?? 0,
      icon: Megaphone,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/admin/announcements',
    },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Good {getGreeting()}, {profile.full_name?.split(' ')[0] ?? 'Admin'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s what needs your attention today.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.href} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentWorkOrders?.length ? (
                <p className="text-sm text-muted-foreground">No open work orders.</p>
              ) : (
                <div className="space-y-3">
                  {recentWorkOrders.map((wo) => (
                    <div key={wo.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{wo.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <StatusBadge value={wo.priority} type="priority" />
                        <StatusBadge value={wo.status} type="status" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentComplaints?.length ? (
                <p className="text-sm text-muted-foreground">No open complaints.</p>
              ) : (
                <div className="space-y-3">
                  {recentComplaints.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.subject}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {c.category} · {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge value={c.status} type="status" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ value, type }: { value: string; type: 'status' | 'priority' }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-600',
    under_review: 'bg-purple-100 text-purple-700',
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  }
  const label = value.replace(/_/g, ' ')
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
