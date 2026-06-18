'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { CategoryBars } from '@/components/finances/CategoryBars'
import { formatBRL, periodLabel } from '@/lib/utils/finance'
import type { FinancialPeriod, FinancialEntry, FinancialCategory } from '@/types/database'

export interface EntryWithCategory extends FinancialEntry {
  financial_categories: Pick<FinancialCategory, 'id' | 'name' | 'type'> | null
}

export interface PeriodWithEntries extends FinancialPeriod {
  entries: EntryWithCategory[]
}

interface Props {
  periods: PeriodWithEntries[]
  isAdmin?: boolean
  onAddEntry?: (periodId: string) => void
  onClosePeriod?: (periodId: string) => void
  onDeleteEntry?: (entryId: string) => void
}

export function PeriodAccordion({ periods, isAdmin, onAddEntry, onClosePeriod, onDeleteEntry }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const open = periods.find((p) => p.status === 'open')
    return open ? new Set([open.id]) : new Set()
  })

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (periods.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        Nenhum período financeiro registrado ainda.
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
      {periods.map((period) => {
        const isOpen = openIds.has(period.id)
        const balance = Number(period.total_income) - Number(period.total_expenses)
        const label = periodLabel(period.year, period.month)

        const categoryEntries = period.entries.map((e) => ({
          categoryName: e.financial_categories?.name ?? 'Outros',
          amount: Number(e.amount),
          type: e.type as 'income' | 'expense',
        }))

        return (
          <div key={period.id} className="bg-white">
            {/* Header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
              onClick={() => toggle(period.id)}
            >
              <span className="text-slate-400">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className="font-medium text-sm text-slate-800">{label}</span>
                <StatusBadge value={period.status === 'open' ? 'open' : 'closed'} />
                {period.status === 'closed' && <Lock className="h-3 w-3 text-slate-400" />}
              </div>
              <div className="hidden sm:flex items-center gap-6 text-xs text-slate-500 shrink-0">
                <span className="text-emerald-600 font-medium">{formatBRL(Number(period.total_income))}</span>
                <span className="text-rose-500 font-medium">−{formatBRL(Number(period.total_expenses))}</span>
                <span className={`font-semibold ${balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  = {formatBRL(balance)}
                </span>
              </div>
              {isAdmin && period.status === 'open' && (
                <div className="flex items-center gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onAddEntry?.(period.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Lançamento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-slate-500"
                    onClick={() => onClosePeriod?.(period.id)}
                  >
                    Fechar período
                  </Button>
                </div>
              )}
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-slate-50/40">
                {/* Mobile totals */}
                <div className="sm:hidden flex gap-4 pt-3 text-xs">
                  <span className="text-emerald-600">Receitas: {formatBRL(Number(period.total_income))}</span>
                  <span className="text-rose-500">Despesas: {formatBRL(Number(period.total_expenses))}</span>
                  <span className={`font-semibold ${balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    Saldo: {formatBRL(balance)}
                  </span>
                </div>

                {period.entries.length === 0 ? (
                  <p className="text-sm text-slate-400 pt-3">Nenhum lançamento neste período.</p>
                ) : (
                  <>
                    {/* Category breakdown bars */}
                    <div className="pt-3">
                      <p className="text-xs font-medium text-slate-500 mb-2">Despesas por categoria</p>
                      <CategoryBars entries={categoryEntries} showType="expense" />
                    </div>

                    {/* Entries table */}
                    <div className="pt-1">
                      <p className="text-xs font-medium text-slate-500 mb-2">Lançamentos</p>
                      <div className="overflow-x-auto rounded border border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 text-slate-500">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Data</th>
                              <th className="text-left px-3 py-2 font-medium">Categoria</th>
                              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Descrição</th>
                              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Fornecedor</th>
                              <th className="text-left px-3 py-2 font-medium">Tipo</th>
                              <th className="text-right px-3 py-2 font-medium">Valor</th>
                              {isAdmin && period.status === 'open' && (
                                <th className="px-3 py-2" />
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {period.entries.map((entry) => (
                              <tr key={entry.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-600">
                                  {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {entry.financial_categories?.name ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-600 hidden sm:table-cell max-w-xs truncate">
                                  {entry.description}
                                </td>
                                <td className="px-3 py-2 text-slate-500 hidden md:table-cell">
                                  {entry.vendor ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge value={entry.type} />
                                </td>
                                <td className={`px-3 py-2 text-right font-medium ${entry.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {entry.type === 'expense' ? '−' : '+'}{formatBRL(Number(entry.amount))}
                                </td>
                                {isAdmin && period.status === 'open' && (
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => onDeleteEntry?.(entry.id)}
                                      className="text-slate-400 hover:text-red-500 transition-colors text-xs"
                                    >
                                      excluir
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
