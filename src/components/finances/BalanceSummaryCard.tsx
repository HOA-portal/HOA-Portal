import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/utils/finance'

interface Props {
  balance: number
  totalIncome: number
  totalExpenses: number
  label?: string
}

export function BalanceSummaryCard({ balance, totalIncome, totalExpenses, label }: Props) {
  const isPositive = balance >= 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {label ?? 'Saldo Geral'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatBRL(balance)}
          </span>
          <span className="text-xs text-slate-400">{isPositive ? '▲ superávit' : '▼ déficit'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Receitas</p>
            <p className="text-sm font-semibold text-emerald-600">{formatBRL(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Despesas</p>
            <p className="text-sm font-semibold text-rose-600">{formatBRL(totalExpenses)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
