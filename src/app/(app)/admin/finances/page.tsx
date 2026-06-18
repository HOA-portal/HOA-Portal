import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { FinancesManager } from '@/components/finances/admin/FinancesManager'
import type { FinancialCategory, FinancialPeriod } from '@/types/database'
import type { PeriodWithEntries } from '@/components/finances/PeriodAccordion'

export default async function AdminFinancesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const [{ data: periods }, { data: categories }] = await Promise.all([
    supabase
      .from('financial_periods')
      .select('id, year, month, status, total_income, total_expenses, notes, closed_at, created_at, updated_at, closed_by, created_by')
      .eq('hoa_id', profile.hoa_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false }),
    supabase
      .from('financial_categories')
      .select('id, hoa_id, name, type, sort_order, is_active, created_at')
      .eq('hoa_id', profile.hoa_id)
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true }),
  ])

  // Fetch entries for all periods in one query
  const periodIds = (periods ?? []).map((p) => p.id)
  const { data: entries } = periodIds.length > 0
    ? await supabase
        .from('financial_entries')
        .select('id, hoa_id, period_id, category_id, type, description, amount, entry_date, vendor, receipt_url, created_by, created_at, updated_at, financial_categories(id, name, type)')
        .in('period_id', periodIds)
        .order('entry_date', { ascending: true })
    : { data: [] }

  // Group entries by period
  const entriesByPeriod: Record<string, unknown[]> = {}
  for (const entry of (entries ?? [])) {
    if (!entriesByPeriod[entry.period_id]) entriesByPeriod[entry.period_id] = []
    entriesByPeriod[entry.period_id]!.push(entry)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodsWithEntries: PeriodWithEntries[] = (periods ?? []).map((p) => ({
    ...(p as FinancialPeriod),
    entries: (entriesByPeriod[p.id] ?? []) as any,
  }))

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Finanças"
          description="Gerencie receitas e despesas mensais do condomínio. Moradores têm acesso de leitura para auditoria."
        />
        <div className="mt-6">
          <FinancesManager
            periods={periodsWithEntries}
            categories={(categories ?? []) as FinancialCategory[]}
          />
        </div>
      </div>
    </div>
  )
}
