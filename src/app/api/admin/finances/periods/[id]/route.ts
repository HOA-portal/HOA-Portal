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

// PATCH: close a period
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify period belongs to this HOA and is open
  const { data: period } = await supabase
    .from('financial_periods')
    .select('id, status')
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .single()

  if (!period) return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 })
  if (period.status === 'closed') {
    return NextResponse.json({ error: 'Este período já está fechado.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('financial_periods')
    .update({
      status: 'closed',
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, year, month, status, total_income, total_expenses, closed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: remove an empty open period
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: period } = await supabase
    .from('financial_periods')
    .select('id, status')
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .single()

  if (!period) return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 })
  if (period.status === 'closed') {
    return NextResponse.json({ error: 'Períodos fechados não podem ser excluídos.' }, { status: 409 })
  }

  // Guard: only delete if no entries exist
  const { count } = await supabase
    .from('financial_entries')
    .select('id', { count: 'exact', head: true })
    .eq('period_id', id)

  if (count && count > 0) {
    return NextResponse.json({ error: 'Exclua todos os lançamentos antes de remover o período.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('financial_periods')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
