import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Profile, FinancialEntryType } from '@/types/database'

export interface ImportEntry {
  description: string
  amount: number
  type: FinancialEntryType
  category_id: string
  vendor?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile || profile.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const hoaId = profile.hoa_id

  const { data: stmt, error: stmtError } = await supabase
    .from('financial_statements')
    .select('id, status, year, month')
    .eq('id', id)
    .eq('hoa_id', hoaId)
    .single()

  if (stmtError || !stmt) return Response.json({ error: 'Statement not found' }, { status: 404 })
  if (stmt.status === 'imported') return Response.json({ error: 'Already imported' }, { status: 409 })

  let body: { entries: ImportEntry[]; year: number; month: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { entries, year, month } = body
  if (!Array.isArray(entries) || entries.length === 0) {
    return Response.json({ error: 'No entries provided' }, { status: 400 })
  }

  // Find or create the financial period for this month
  let periodId: string

  const { data: existing } = await supabase
    .from('financial_periods')
    .select('id, status')
    .eq('hoa_id', hoaId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'closed') {
      return Response.json({ error: 'Financial period is already closed and cannot be modified' }, { status: 409 })
    }
    periodId = existing.id
  } else {
    // Create new period (seeding default categories if this is the first period ever)
    const { data: newPeriod, error: periodError } = await supabase
      .from('financial_periods')
      .insert({
        hoa_id: hoaId,
        year,
        month,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (periodError || !newPeriod) {
      return Response.json({ error: `Failed to create period: ${periodError?.message}` }, { status: 500 })
    }
    periodId = newPeriod.id

    // Seed default categories on first period (same behaviour as manual period creation)
    const { count } = await supabase
      .from('financial_categories')
      .select('*', { count: 'exact', head: true })
      .eq('hoa_id', hoaId)

    if (!count || count === 0) {
      await supabase.rpc('seed_default_financial_categories', {
        p_hoa_id: hoaId,
        p_admin_id: user.id,
      })
    }
  }

  // Build the entry date: first day of the statement month
  const entryDate = `${year}-${String(month).padStart(2, '0')}-01`

  const rows = entries.map((e) => ({
    hoa_id: hoaId,
    period_id: periodId,
    category_id: e.category_id,
    type: e.type,
    description: e.description,
    amount: e.amount,
    entry_date: entryDate,
    vendor: e.vendor ?? null,
    created_by: user.id,
  }))

  const { error: insertError } = await supabase.from('financial_entries').insert(rows)
  if (insertError) {
    return Response.json({ error: `Failed to insert entries: ${insertError.message}` }, { status: 500 })
  }

  await supabase
    .from('financial_statements')
    .update({ status: 'imported', imported_period_id: periodId })
    .eq('id', id)

  revalidatePath('/admin/finances')
  revalidatePath('/finances')

  return Response.json({ ok: true, periodId, entriesCreated: rows.length })
}
