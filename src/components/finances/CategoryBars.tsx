import { formatBRL } from '@/lib/utils/finance'

interface CategoryEntry {
  categoryName: string
  amount: number
  type: 'income' | 'expense'
}

interface Props {
  entries: CategoryEntry[]
  showType?: 'income' | 'expense' | 'both'
}

export function CategoryBars({ entries, showType = 'expense' }: Props) {
  const filtered = showType === 'both' ? entries : entries.filter((e) => e.type === showType)

  if (filtered.length === 0) return null

  const grouped: Record<string, { amount: number; type: 'income' | 'expense' }> = {}
  for (const entry of filtered) {
    if (!grouped[entry.categoryName]) grouped[entry.categoryName] = { amount: 0, type: entry.type }
    grouped[entry.categoryName].amount += entry.amount
  }

  const rows = Object.entries(grouped)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)

  const max = rows[0]?.amount ?? 1

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pct = Math.round((row.amount / max) * 100)
        const barColor = row.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'
        return (
          <div key={row.name} className="flex items-center gap-3">
            <div className="w-28 text-xs text-slate-600 truncate shrink-0">{row.name}</div>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
              <div
                className={`h-1.5 rounded-full ${barColor} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-24 text-right text-xs font-medium text-slate-700 shrink-0">
              {formatBRL(row.amount)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
