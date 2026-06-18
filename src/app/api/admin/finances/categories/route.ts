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
    .from('financial_categories')
    .select('id, name, type, sort_order, is_active')
    .eq('hoa_id', profile.hoa_id)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, type } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name é obrigatório.' }, { status: 400 })
  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type deve ser "income" ou "expense".' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('financial_categories')
    .insert({
      hoa_id: profile.hoa_id,
      name: name.trim(),
      type,
    })
    .select('id, name, type, sort_order, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
