import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResidentFinancialDashboard } from '@/components/finances/ResidentFinancialDashboard'
import type { FinancialPeriod } from '@/types/database'
import type { PeriodWithEntries } from '@/components/finances/PeriodAccordion'

export default async function FinancesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('hoa_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: periods } = await supabase
    .from('financial_periods')
    .select('id, year, month, status, total_income, total_expenses, notes, closed_at, created_at, updated_at, closed_by, created_by')
    .eq('hoa_id', profile.hoa_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  const periodIds = (periods ?? []).map((p) => p.id)
  const { data: entries } = periodIds.length > 0
    ? await supabase
        .from('financial_entries')
        .select('id, hoa_id, period_id, category_id, type, description, amount, entry_date, vendor, receipt_url, created_by, created_at, updated_at, financial_categories(id, name, type)')
        .in('period_id', periodIds)
        .order('entry_date', { ascending: true })
    : { data: [] }

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
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Finanças do Condomínio</h1>
          <p className="text-sm text-slate-500 mt-1">
            Transparência total — consulte o saldo, receitas, despesas e histórico por mês.
          </p>
        </div>
        <ResidentFinancialDashboard periods={periodsWithEntries} />
      </div>
    </div>
  )
}
