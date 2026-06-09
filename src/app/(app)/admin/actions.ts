'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  WorkOrderStatus,
  ComplaintStatus,
  ViolationStatus,
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
  revalidatePath('/admin/announcements')
  revalidatePath('/admin')
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
