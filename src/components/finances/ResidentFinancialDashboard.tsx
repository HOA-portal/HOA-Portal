'use client'

import { BalanceSummaryCard } from '@/components/finances/BalanceSummaryCard'
import { PeriodAccordion, type PeriodWithEntries } from '@/components/finances/PeriodAccordion'
import {
  computeRunningBalance,
  computeTotalIncome,
  computeTotalExpenses,
} from '@/lib/utils/finance'

interface Props {
  periods: PeriodWithEntries[]
}

export function ResidentFinancialDashboard({ periods }: Props) {
  const balance = computeRunningBalance(periods)
  const totalIncome = computeTotalIncome(periods)
  const totalExpenses = computeTotalExpenses(periods)

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <BalanceSummaryCard
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          label="Saldo Acumulado do Condomínio"
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-3">Histórico por período</h2>
        <PeriodAccordion periods={periods} isAdmin={false} />
      </div>
    </div>
  )
}
