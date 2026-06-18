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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const profile = await getAdminProfile(supabase)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = body.name?.trim()
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order)
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('financial_categories')
    .update(updates)
    .eq('id', id)
    .eq('hoa_id', profile.hoa_id)
    .select('id, name, type, sort_order, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 })
  return NextResponse.json(data)
}
