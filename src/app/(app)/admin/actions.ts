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
