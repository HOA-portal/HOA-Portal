'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/notifications/email'
import { sendSms } from '@/lib/notifications/sms'
import type {
  WorkOrderStatus,
  ComplaintStatus,
  ViolationStatus,
  FinancialEntryType,
} from '@/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') redirect('/chat')
  return { supabase, hoaId: profile.hoa_id as string, userId: user.id }
}

// ── Work Orders ───────────────────────────────────────────────────────────────

export async function updateWorkOrder(
  workOrderId: string,
  updates: { status?: WorkOrderStatus; admin_notes?: string }
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()
  const { error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', workOrderId)
    .eq('hoa_id', hoaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/work-orders')
  revalidatePath('/admin')
  return {}
}

// ── Complaints ────────────────────────────────────────────────────────────────

export async function updateComplaint(
  complaintId: string,
  updates: { status?: ComplaintStatus; admin_notes?: string }
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()
  const { error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', complaintId)
    .eq('hoa_id', hoaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/complaints')
  revalidatePath('/admin')
  return {}
}

// ── Violations ────────────────────────────────────────────────────────────────

export async function issueViolation(
  violationId: string,
  formalNotice: string
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()
  const { error } = await supabase
    .from('violations')
    .update({
      status: 'issued' as ViolationStatus,
      formal_notice: formalNotice,
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', violationId)
    .eq('hoa_id', hoaId)
    .eq('status', 'draft')
  if (error) return { error: error.message }
  revalidatePath('/admin/violations')
  revalidatePath('/admin')
  return {}
}

export async function updateViolationStatus(
  violationId: string,
  status: ViolationStatus
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()
  const { error } = await supabase
    .from('violations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', violationId)
    .eq('hoa_id', hoaId)
  if (error) return { error: error.message }
  revalidatePath('/admin/violations')
  return {}
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function createAnnouncement(data: {
  subject: string
  body: string
  send_email: boolean
  send_sms: boolean
}): Promise<{ error?: string }> {
  const { supabase, hoaId, userId } = await requireAdmin()
  const { error } = await supabase.from('announcements').insert({
    hoa_id: hoaId,
    created_by: userId,
    subject: data.subject,
    body: data.body,
    send_email: data.send_email,
    send_sms: data.send_sms,
    status: 'draft' as const,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/announcements')
  return {}
}

export async function publishAnnouncement(
  announcementId: string
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()

  const { data: announcement } = await supabase
    .from('announcements')
    .select('subject, body, send_email, send_sms')
    .eq('id', announcementId)
    .eq('hoa_id', hoaId)
    .eq('status', 'draft')
    .single()

  if (!announcement) return { error: 'Announcement not found or already published' }

  const { error } = await supabase
    .from('announcements')
    .update({
      status: 'published' as const,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', announcementId)
    .eq('hoa_id', hoaId)
    .eq('status', 'draft')

  if (error) return { error: error.message }

  if (announcement.send_email || announcement.send_sms) {
    await dispatchAnnouncementNotifications(hoaId, announcement)
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/admin')
  return {}
}

async function dispatchAnnouncementNotifications(
  hoaId: string,
  announcement: { subject: string; body: string; send_email: boolean; send_sms: boolean }
) {
  const serviceClient = await createServiceClient()

  const { data: residents } = await serviceClient
    .from('profiles')
    .select('id, phone')
    .eq('hoa_id', hoaId)
    .eq('role', 'resident')

  if (!residents?.length) return

  const tasks: Promise<void>[] = []

  if (announcement.send_email) {
    const { data: { users } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    const emailById = new Map(users.map(u => [u.id, u.email]))
    const bodyHtml = `<p>${announcement.body.replace(/\n/g, '<br>')}</p>`

    for (const resident of residents) {
      const email = emailById.get(resident.id)
      if (email) tasks.push(sendEmail(email, announcement.subject, bodyHtml))
    }
  }

  if (announcement.send_sms) {
    const smsBody = `${announcement.subject}\n\n${announcement.body}`
    for (const resident of residents) {
      if (resident.phone) tasks.push(sendSms(resident.phone, smsBody))
    }
  }

  await Promise.allSettled(tasks)
}

// ── Finances ──────────────────────────────────────────────────────────────────

export async function createFinancialPeriod(
  year: number,
  month: number,
): Promise<{ data?: { id: string }; error?: string }> {
  const { supabase, hoaId, userId } = await requireAdmin()

  // Seed categories if this is the HOA's first period
  const { count } = await supabase
    .from('financial_categories')
    .select('id', { count: 'exact', head: true })
    .eq('hoa_id', hoaId)

  if (count === 0) {
    await supabase.rpc('seed_default_financial_categories', {
      p_hoa_id: hoaId,
      p_admin_id: userId,
    })
  }

  const { data, error } = await supabase
    .from('financial_periods')
    .insert({ hoa_id: hoaId, year, month, created_by: userId })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Já existe um período para esse mês.' }
    return { error: error.message }
  }

  revalidatePath('/admin/finances')
  revalidatePath('/finances')
  return { data: { id: data.id } }
}

export async function closePeriod(periodId: string): Promise<{ error?: string }> {
  const { supabase, hoaId, userId } = await requireAdmin()

  const { data: period } = await supabase
    .from('financial_periods')
    .select('id, status')
    .eq('id', periodId)
    .eq('hoa_id', hoaId)
    .single()

  if (!period) return { error: 'Período não encontrado.' }
  if (period.status === 'closed') return { error: 'Este período já está fechado.' }

  const { error } = await supabase
    .from('financial_periods')
    .update({ status: 'closed', closed_by: userId, closed_at: new Date().toISOString() })
    .eq('id', periodId)

  if (error) return { error: error.message }

  revalidatePath('/admin/finances')
  revalidatePath('/admin')
  revalidatePath('/finances')
  return {}
}

export async function createFinancialEntry(
  periodId: string,
  data: {
    category_id: string
    type: FinancialEntryType
    description: string
    amount: number
    entry_date: string
    vendor?: string
    receipt_url?: string
  },
): Promise<{ data?: { id: string }; error?: string }> {
  const { supabase, hoaId, userId } = await requireAdmin()

  const { data: period } = await supabase
    .from('financial_periods')
    .select('id, status')
    .eq('id', periodId)
    .eq('hoa_id', hoaId)
    .single()

  if (!period) return { error: 'Período não encontrado.' }
  if (period.status === 'closed') return { error: 'Não é possível adicionar lançamentos a um período fechado.' }

  const { data: entry, error } = await supabase
    .from('financial_entries')
    .insert({
      hoa_id: hoaId,
      period_id: periodId,
      category_id: data.category_id,
      type: data.type,
      description: data.description.trim(),
      amount: data.amount,
      entry_date: data.entry_date,
      vendor: data.vendor?.trim() || null,
      receipt_url: data.receipt_url || null,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/finances')
  revalidatePath('/finances')
  return { data: { id: entry.id } }
}

export async function updateFinancialEntry(
  entryId: string,
  updates: Partial<{
    category_id: string
    description: string
    amount: number
    entry_date: string
    vendor: string | null
    receipt_url: string | null
  }>,
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()

  // Guard: verify entry belongs to HOA and period is open
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('id, financial_periods(status)')
    .eq('id', entryId)
    .eq('hoa_id', hoaId)
    .single()

  if (!entry) return { error: 'Lançamento não encontrado.' }
  const period = (entry.financial_periods as unknown) as { status: string } | null
  if (period?.status === 'closed') return { error: 'Não é possível alterar lançamentos de um período fechado.' }

  const { error } = await supabase
    .from('financial_entries')
    .update(updates)
    .eq('id', entryId)

  if (error) return { error: error.message }

  revalidatePath('/admin/finances')
  revalidatePath('/finances')
  return {}
}

export async function deleteFinancialEntry(entryId: string): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()

  const { data: entry } = await supabase
    .from('financial_entries')
    .select('id, financial_periods(status)')
    .eq('id', entryId)
    .eq('hoa_id', hoaId)
    .single()

  if (!entry) return { error: 'Lançamento não encontrado.' }
  const period = (entry.financial_periods as unknown) as { status: string } | null
  if (period?.status === 'closed') return { error: 'Não é possível excluir lançamentos de um período fechado.' }

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', entryId)

  if (error) return { error: error.message }

  revalidatePath('/admin/finances')
  revalidatePath('/finances')
  return {}
}

export async function deleteAnnouncement(
  announcementId: string
): Promise<{ error?: string }> {
  const { supabase, hoaId } = await requireAdmin()
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId)
    .eq('hoa_id', hoaId)
    .eq('status', 'draft')
  if (error) return { error: error.message }
  revalidatePath('/admin/announcements')
  return {}
}
