'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BalanceSummaryCard } from '@/components/finances/BalanceSummaryCard'
import { PeriodAccordion, type PeriodWithEntries } from '@/components/finances/PeriodAccordion'
import { EntryFormModal } from '@/components/finances/admin/EntryFormModal'
import { StatementUploadModal } from '@/components/finances/admin/StatementUploadModal'
import { StatementReviewModal } from '@/components/finances/admin/StatementReviewModal'
import {
  computeRunningBalance,
  computeTotalIncome,
  computeTotalExpenses,
} from '@/lib/utils/finance'
import { createFinancialPeriod, closePeriod, deleteFinancialEntry } from '@/app/(app)/admin/actions'
import type { FinancialCategory } from '@/types/database'
import type { ParsedStatement } from '@/lib/ai/financial-parser-types'

interface Props {
  periods: PeriodWithEntries[]
  categories: FinancialCategory[]
}

export function FinancesManager({ periods, categories }: Props) {
  const router = useRouter()
  const [entryModalPeriodId, setEntryModalPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reviewData, setReviewData] = useState<{ statementId: string; parsed: ParsedStatement } | null>(null)

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
      toast.success('Period created')
      router.refresh()
    }
  }

  async function handleClosePeriod(periodId: string) {
    const confirmed = window.confirm('Close this period? Entries can no longer be edited.')
    if (!confirmed) return
    const result = await closePeriod(periodId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Period closed')
      router.refresh()
    }
  }

  async function handleDeleteEntry(entryId: string) {
    const confirmed = window.confirm('Delete this entry?')
    if (!confirmed) return
    const result = await deleteFinancialEntry(entryId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Entry deleted')
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
          label="Accumulated Balance"
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Monthly Periods</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import PDF Statement
          </Button>
          {!hasCurrentMonth && (
            <Button size="sm" onClick={handleCreatePeriod} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              New Period
            </Button>
          )}
        </div>
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

      <StatementUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onParsed={(statementId, parsed) => setReviewData({ statementId, parsed })}
      />

      {reviewData && (
        <StatementReviewModal
          open={!!reviewData}
          onClose={() => setReviewData(null)}
          statementId={reviewData.statementId}
          parsed={reviewData.parsed}
          categories={categories}
        />
      )}
    </div>
  )
}
