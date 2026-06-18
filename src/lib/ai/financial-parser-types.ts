// Shared types and pure utility functions for financial statement parsing.
// Safe to import from client components (no Node.js / server-only dependencies).

export interface StatementLineItem {
  name: string
  amount: number
  category_hint: string
}

export interface ParsedStatement {
  year: number
  month: number
  period_label: string
  income: StatementLineItem[]
  expenses: StatementLineItem[]
  total_income: number
  total_expenses: number
  net_income: number
  confidence: 'high' | 'medium' | 'low'
}

// Maps common PDF category group names to the default financial_categories names.
// Returns null when no match found — admin picks manually in the review UI.
export function matchCategoryHint(hint: string, categoryNames: string[]): string | null {
  const h = hint.toUpperCase()

  const hintMap: [RegExp, string[]][] = [
    [/RENT|HOA\s*DUE|DUES/, ['Taxa de Condomínio', 'HOA Dues', 'Dues']],
    [/SPECIAL\s*ASSESS|ASSESSMENT/, ['Multas e Juros', 'Special Assessment', 'Outros (Receita)', 'Outros']],
    [/INSUR/, ['Segurança', 'Insurance', 'Property Insurance']],
    [/UTIL|WATER|SEWER|GARBAGE|RECYCL|TRASH/, ['Utilities', 'Utilities', 'Limpeza']],
    [/CLEAN|JANITORIAL/, ['Limpeza', 'Cleaning']],
    [/MAINT|REPAIR|LABOR/, ['Manutenção', 'Maintenance']],
    [/GARDEN|LANDSCAP|LAWN/, ['Jardins', 'Landscaping']],
    [/SECUR|GUARD/, ['Segurança', 'Security']],
    [/MANAG|ADMIN|FEE|ONBOARD/, ['Administrativo', 'Management', 'Administrative']],
    [/RESERV|FUND/, ['Fundo de Reserva', 'Reserve Fund']],
    [/OBRA|CONSTRUCT|CAPITAL/, ['Obras', 'Capital Improvements']],
  ]

  for (const [pattern, candidates] of hintMap) {
    if (pattern.test(h)) {
      for (const candidate of candidates) {
        const match = categoryNames.find(
          (n) => n.toLowerCase() === candidate.toLowerCase()
        )
        if (match) return match
      }
    }
  }
  return null
}
