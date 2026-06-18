'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BalanceSummaryCard } from '@/components/finances/BalanceSummaryCard'
import { PeriodAccordion, type PeriodWithEntries } from '@/components/finances/PeriodAccordion'
import { EntryFormModal } from '@/components/finances/admin/EntryFormModal'
import {
  computeRunningBalance,
  computeTotalIncome,
  computeTotalExpenses,
} from '@/lib/utils/finance'
import { createFinancialPeriod, closePeriod, deleteFinancialEntry } from '@/app/(app)/admin/actions'
import type { FinancialCategory } from '@/types/database'

interface Props {
  periods: PeriodWithEntries[]
  categories: FinancialCategory[]
}

export function FinancesManager({ periods, categories }: Props) {
  const router = useRouter()
  const [entryModalPeriodId, setEntryModalPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const balance = computeRunningBalance(periods)
  const totalIncome = computeTotalIncome(periods)
  const totalExpenses = computeTotalExpenses(periods)

  const hasCurrentMonth = periods.some((p) => {
    const now = new Date()
    return p.year === now.getFullYear() && p.month === now.getMonth() + 1
  })

  async function handleCreatePeriod() {
    const now = new Date()
    setLoading(true)
    const result = await createFinancialPeriod(now.getFullYear(), now.getMonth() + 1)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Período criado')
      router.refresh()
    }
  }

  async function handleClosePeriod(periodId: string) {
    const confirmed = window.confirm('Fechar este período? Lançamentos não poderão mais ser editados.')
    if (!confirmed) return
    const result = await closePeriod(periodId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Período fechado')
      router.refresh()
    }
  }

  async function handleDeleteEntry(entryId: string) {
    const confirmed = window.confirm('Excluir este lançamento?')
    if (!confirmed) return
    const result = await deleteFinancialEntry(entryId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Lançamento excluído')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="max-w-xs">
        <BalanceSummaryCard
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          label="Saldo Acumulado"
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Períodos mensais</h2>
        {!hasCurrentMonth && (
          <Button size="sm" onClick={handleCreatePeriod} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Novo período
          </Button>
        )}
      </div>

      <PeriodAccordion
        periods={periods}
        isAdmin
        onAddEntry={(periodId) => setEntryModalPeriodId(periodId)}
        onClosePeriod={handleClosePeriod}
        onDeleteEntry={handleDeleteEntry}
      />

      {entryModalPeriodId && (
        <EntryFormModal
          open={!!entryModalPeriodId}
          onClose={() => setEntryModalPeriodId(null)}
          periodId={entryModalPeriodId}
          categories={categories}
        />
      )}
    </div>
  )
}
