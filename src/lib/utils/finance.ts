import type { FinancialPeriod } from '@/types/database'

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

export function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES_PT[month - 1]} ${year}`
}

export function computeRunningBalance(periods: Pick<FinancialPeriod, 'total_income' | 'total_expenses'>[]): number {
  return periods.reduce(
    (acc, p) => acc + Number(p.total_income) - Number(p.total_expenses),
    0,
  )
}

export function computeTotalIncome(periods: Pick<FinancialPeriod, 'total_income'>[]): number {
  return periods.reduce((acc, p) => acc + Number(p.total_income), 0)
}

export function computeTotalExpenses(periods: Pick<FinancialPeriod, 'total_expenses'>[]): number {
  return periods.reduce((acc, p) => acc + Number(p.total_expenses), 0)
}
