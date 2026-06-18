import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, hoa_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

async function guardOpenPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  hoaId: string,
) {
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('id, period_id, financial_periods(status)')
    .eq('id', entryId)
    .eq('hoa_id', hoaId)
    .single()

  if (!entry) return { entry: null, error: 'Lançamento não encontrado.', status: 404 }
  const period = (entry.financial_periods as unknown) as { status: string } | null
  if (period?.status === 'closed') {
    return { entry: null, error: 'Não é possível alterar lançamentos de um período fechado.', status: 409 }
  }
  return { entry, error: null, status: 200 }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { entry, error: guardError, status: guardStatus } = await guardOpenPeriod(supabase, id, profile.hoa_id)
  if (guardError) return NextResponse.json({ error: guardError }, { status: guardStatus })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.category_id !== undefined) updates.category_id = body.category_id
  if (body.type !== undefined) updates.type = body.type
  if (body.description !== undefined) updates.description = body.description?.trim()
  if (body.amount !== undefined) {
    const amt = Number(body.amount)
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: 'amount inválido.' }, { status: 400 })
    updates.amount = amt
  }
  if (body.entry_date !== undefined) updates.entry_date = body.entry_date
  if (body.vendor !== undefined) updates.vendor = body.vendor?.trim() || null
  if (body.receipt_url !== undefined) updates.receipt_url = body.receipt_url || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  void entry // verified above

  const { data, error } = await supabase
    .from('financial_entries')
    .update(updates)
    .eq('id', id)
    .select('id, type, description, amount, entry_date, vendor, receipt_url, financial_categories(id, name, type)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error: guardError, status: guardStatus } = await guardOpenPeriod(supabase, id, profile.hoa_id)
  if (guardError) return NextResponse.json({ error: guardError }, { status: guardStatus })

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
