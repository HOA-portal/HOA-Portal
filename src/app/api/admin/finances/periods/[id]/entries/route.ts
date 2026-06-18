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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify period belongs to this HOA
  const { data: period } = await supabase
    .from('financial_periods')
    .select('id')
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .single()

  if (!period) return NextResponse.json({ error: 'Período não encontrado.' }, { status: 404 })

  const { data, error } = await supabase
    .from('financial_entries')
    .select('id, type, description, amount, entry_date, vendor, receipt_url, created_at, financial_categories(id, name, type)')
    .eq('period_id', id)
    .order('entry_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
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
    return NextResponse.json({ error: 'Não é possível adicionar lançamentos a um período fechado.' }, { status: 409 })
  }

  const { category_id, type, description, amount, entry_date, vendor, receipt_url } = await req.json()

  if (!category_id || !type || !description?.trim() || !amount || !entry_date) {
    return NextResponse.json({ error: 'Campos obrigatórios: category_id, type, description, amount, entry_date.' }, { status: 400 })
  }

  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type deve ser "income" ou "expense".' }, { status: 400 })
  }

  const parsedAmount = Number(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'amount deve ser um número positivo.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      hoa_id: profile.hoa_id,
      period_id: id,
      category_id,
      type,
      description: description.trim(),
      amount: parsedAmount,
      entry_date,
      vendor: vendor?.trim() || null,
      receipt_url: receipt_url || null,
      created_by: profile.id,
    })
    .select('id, type, description, amount, entry_date, vendor, receipt_url, created_at, financial_categories(id, name, type)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
