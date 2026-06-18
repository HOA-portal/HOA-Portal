'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createFinancialEntry } from '@/app/(app)/admin/actions'
import type { FinancialCategory, FinancialEntryType } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  periodId: string
  categories: FinancialCategory[]
}

export function EntryFormModal({ open, onClose, periodId, categories }: Props) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState<FinancialEntryType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [vendor, setVendor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCategory = categories.find((c) => c.id === categoryId)

  function handleCategoryChange(id: string) {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat) setType(cat.type as FinancialEntryType)
  }

  function reset() {
    setCategoryId('')
    setType('expense')
    setDescription('')
    setAmount('')
    setEntryDate(new Date().toISOString().slice(0, 10))
    setVendor('')
    setError(null)
  }

  function handleClose() {
    if (saving) return
    reset()
    onClose()
  }

  async function handleSave() {
    if (!categoryId || !description.trim() || !amount || !entryDate) return
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await createFinancialEntry(periodId, {
      category_id: categoryId,
      type,
      description: description.trim(),
      amount: parsedAmount,
      entry_date: entryDate,
      vendor: vendor.trim() || undefined,
    })

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      toast.success('Lançamento adicionado')
      router.refresh()
      reset()
      onClose()
    }
  }

  const activeCategories = categories.filter((c) => c.is_active)
  const isValid = categoryId && description.trim() && amount && entryDate

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Novo Lançamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Categoria <span className="text-red-500">*</span>
            </label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-medium text-slate-400">Receitas</div>
                {activeCategories.filter((c) => c.type === 'income').map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-medium text-slate-400 mt-1">Despesas</div>
                {activeCategories.filter((c) => c.type === 'expense').map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && (
            <div className="text-xs text-slate-500 -mt-2">
              Tipo: <span className={selectedCategory.type === 'income' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                {selectedCategory.type === 'income' ? 'Receita' : 'Despesa'}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Descrição <span className="text-red-500">*</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Manutenção da piscina"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Data <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Fornecedor (opcional)</label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Ex: Empresa de Limpeza LTDA"
              className="h-8 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isValid}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
