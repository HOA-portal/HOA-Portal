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

export async function GET() {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('financial_periods')
    .select('id, year, month, status, total_income, total_expenses, notes, closed_at, created_at')
    .eq('hoa_id', profile.hoa_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year, month } = await req.json()
  if (!year || !month) return NextResponse.json({ error: 'year e month são obrigatórios.' }, { status: 400 })

  const y = Number(year)
  const m = Number(month)
  if (m < 1 || m > 12 || y < 2000 || y > 2100) {
    return NextResponse.json({ error: 'Ano ou mês inválido.' }, { status: 400 })
  }

  // Check for existing categories — seed defaults if this is the HOA's first period
  const { count } = await supabase
    .from('financial_categories')
    .select('id', { count: 'exact', head: true })
    .eq('hoa_id', profile.hoa_id)

  if (count === 0) {
    await supabase.rpc('seed_default_financial_categories', {
      p_hoa_id: profile.hoa_id,
      p_admin_id: profile.id,
    })
  }

  const { data, error } = await supabase
    .from('financial_periods')
    .insert({
      hoa_id: profile.hoa_id,
      year: y,
      month: m,
      created_by: profile.id,
    })
    .select('id, year, month, status, total_income, total_expenses, notes, closed_at, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe um período para esse mês.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
