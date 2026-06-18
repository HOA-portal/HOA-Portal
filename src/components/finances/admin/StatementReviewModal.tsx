'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { matchCategoryHint, type ParsedStatement, type StatementLineItem } from '@/lib/ai/financial-parser-types'
import type { FinancialCategory, FinancialEntryType } from '@/types/database'

interface ReviewRow {
  id: string
  included: boolean
  name: string
  amount: number
  type: FinancialEntryType
  categoryId: string
  vendor?: string
}

interface Props {
  open: boolean
  onClose: () => void
  statementId: string
  parsed: ParsedStatement
  categories: FinancialCategory[]
}

function buildRows(
  items: StatementLineItem[],
  type: FinancialEntryType,
  categories: FinancialCategory[]
): ReviewRow[] {
  return items.map((item, i) => {
    const catNames = categories.map((c) => c.name)
    const matched = matchCategoryHint(item.category_hint, catNames)
    const cat = categories.find(
      (c) => c.name === matched && c.type === type
    ) ?? categories.find((c) => c.type === type)

    return {
      id: `${type}-${i}`,
      included: true,
      name: item.name,
      amount: item.amount,
      type,
      categoryId: cat?.id ?? '',
    }
  })
}

function formatAmount(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function StatementReviewModal({ open, onClose, statementId, parsed, categories }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ReviewRow[]>(() => [
    ...buildRows(parsed.income, 'income', categories),
    ...buildRows(parsed.expenses, 'expense', categories),
  ])
  const [importing, setImporting] = useState(false)

  const activeCategories = categories.filter((c) => c.is_active)
  const includedRows = rows.filter((r) => r.included)
  const importedIncome = includedRows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const importedExpenses = includedRows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const incomeDiff = Math.abs(importedIncome - parsed.total_income) > 0.01
  const expenseDiff = Math.abs(importedExpenses - parsed.total_expenses) > 0.01
  const hasWarning = incomeDiff || expenseDiff
  const missingCategory = includedRows.some((r) => !r.categoryId)

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function handleImport() {
    if (missingCategory) {
      toast.error('Selecione uma categoria para todos os lançamentos incluídos.')
      return
    }
    setImporting(true)

    const entries = includedRows.map((r) => ({
      description: r.name,
      amount: r.amount,
      type: r.type,
      category_id: r.categoryId,
      vendor: r.vendor,
    }))

    const res = await fetch(`/api/admin/finances/statements/${statementId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, year: parsed.year, month: parsed.month }),
    })

    setImporting(false)

    if (res.ok) {
      toast.success(`${entries.length} lançamentos importados com sucesso`)
      router.refresh()
      onClose()
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Erro ao importar. Tente novamente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !importing && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">
            Revisar Extrato — {parsed.period_label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Confirme os lançamentos extraídos e mapeie para as categorias do condomínio.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 pr-4 pb-4">
            {/* Income section */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Receitas</h3>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                  {formatAmount(parsed.total_income)} total no PDF
                </Badge>
              </div>
              <EntryTable
                rows={rows.filter((r) => r.type === 'income')}
                categories={activeCategories.filter((c) => c.type === 'income')}
                onUpdate={updateRow}
              />
            </section>

            {/* Expense section */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">Despesas</h3>
                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-xs">
                  {formatAmount(parsed.total_expenses)} total no PDF
                </Badge>
              </div>
              <EntryTable
                rows={rows.filter((r) => r.type === 'expense')}
                categories={activeCategories.filter((c) => c.type === 'expense')}
                onUpdate={updateRow}
              />
            </section>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t pt-3 space-y-3">
          {hasWarning && (
            <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Os totais selecionados diferem do PDF original.
                {incomeDiff && ` Receitas: ${formatAmount(importedIncome)} vs ${formatAmount(parsed.total_income)}.`}
                {expenseDiff && ` Despesas: ${formatAmount(importedExpenses)} vs ${formatAmount(parsed.total_expenses)}.`}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">{includedRows.length}</span> de {rows.length} lançamentos selecionados
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || includedRows.length === 0 || missingCategory}
              >
                {importing ? 'Importando…' : `Importar ${includedRows.length} lançamentos`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface EntryTableProps {
  rows: ReviewRow[]
  categories: FinancialCategory[]
  onUpdate: (id: string, patch: Partial<ReviewRow>) => void
}

function EntryTable({ rows, categories, onUpdate }: EntryTableProps) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhum item encontrado.</p>
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b">
            <th className="w-8 py-2 px-2 text-center font-medium text-slate-500"></th>
            <th className="py-2 px-3 text-left font-medium text-slate-500">Descrição</th>
            <th className="py-2 px-3 text-left font-medium text-slate-500 w-40">Categoria</th>
            <th className="py-2 px-3 text-right font-medium text-slate-500 w-28">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.included ? 'bg-white' : 'bg-slate-50 opacity-50'}>
              <td className="py-2 px-2 text-center">
                <Checkbox
                  checked={row.included}
                  onCheckedChange={(v) => onUpdate(row.id, { included: !!v })}
                />
              </td>
              <td className="py-2 px-3 text-slate-800">{row.name}</td>
              <td className="py-2 px-3">
                <Select
                  value={row.categoryId}
                  onValueChange={(v) => onUpdate(row.id, { categoryId: v })}
                  disabled={!row.included}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="py-2 px-3 text-right">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => onUpdate(row.id, { amount: parseFloat(e.target.value) || 0 })}
                  disabled={!row.included}
                  className="h-7 text-xs text-right w-24 ml-auto"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
