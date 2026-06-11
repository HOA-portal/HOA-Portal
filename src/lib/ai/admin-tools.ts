import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { searchCCRs, buildPassage } from './rag'
import { buildResidentTools } from './resident-tools'
import type { Profile } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export function buildAdminTools(profile: Profile) {
  const { hoa_id: hoaId, id: adminId } = profile

  const residentTools = buildResidentTools(profile)

  return {
    // Include all resident tools
    ...residentTools,

    listWorkOrders: tool({
      description: 'List all work orders for the community with optional status filter.',
      parameters: z.object({
        status: z
          .enum(['open', 'in_progress', 'resolved', 'closed', 'all'])
          .optional()
          .default('open'),
      }),
      execute: async ({ status }) => {
        const supabase = await createClient() as Db
        let query = supabase
          .from('work_orders')
          .select(
            'id, title, status, priority, created_at, admin_notes, profiles(full_name, unit_number)'
          )
          .eq('hoa_id', hoaId)
          .order('created_at', { ascending: false })
          .limit(20)

        if (status !== 'all') {
          query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) return { error: 'Could not load work orders.' }
        return { workOrders: data ?? [] }
      },
    }),

    updateWorkOrder: tool({
      description: 'Update the status or add admin notes to a work order.',
      parameters: z.object({
        workOrderId: z.string().describe('The UUID of the work order to update'),
        status: z
          .enum(['open', 'in_progress', 'resolved', 'closed'])
          .optional()
          .describe('New status'),
        adminNotes: z.string().optional().describe('Admin notes or update for the resident'),
      }),
      execute: async ({ workOrderId, status, adminNotes }) => {
        const supabase = await createClient() as Db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: Record<string, any> = {}
        if (status) updates.status = status
        if (adminNotes) updates.admin_notes = adminNotes

        const { error } = await supabase
          .from('work_orders')
          .update(updates)
          .eq('id', workOrderId)
          .eq('hoa_id', hoaId)

        if (error) return { success: false, error: 'Could not update work order.' }
        return { success: true, workOrderId, updates }
      },
    }),

    listComplaints: tool({
      description: 'List all formal complaints filed by residents.',
      parameters: z.object({
        status: z
          .enum(['open', 'under_review', 'resolved', 'closed', 'all'])
          .optional()
          .default('open'),
      }),
      execute: async ({ status }) => {
        const supabase = await createClient() as Db
        let query = supabase
          .from('complaints')
          .select('id, subject, description, category, status, created_at, evidence_urls')
          .eq('hoa_id', hoaId)
          .order('created_at', { ascending: false })
          .limit(20)

        if (status !== 'all') {
          query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) return { error: 'Could not load complaints.' }
        return { complaints: data ?? [] }
      },
    }),

    updateComplaint: tool({
      description: "Update a complaint's status or add admin notes.",
      parameters: z.object({
        complaintId: z.string().describe('The UUID of the complaint'),
        status: z
          .enum(['open', 'under_review', 'resolved', 'closed'])
          .optional(),
        adminNotes: z.string().optional(),
      }),
      execute: async ({ complaintId, status, adminNotes }) => {
        const supabase = await createClient() as Db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: Record<string, any> = {}
        if (status) updates.status = status
        if (adminNotes) updates.admin_notes = adminNotes

        const { error } = await supabase
          .from('complaints')
          .update(updates)
          .eq('id', complaintId)
          .eq('hoa_id', hoaId)

        if (error) return { success: false, error: 'Could not update complaint.' }
        return { success: true, complaintId, updates }
      },
    }),

    createViolation: tool({
      description:
        'Document a formal rule violation. The AI will search for the applicable rule and generate a formal violation notice. Use when you have observed a rule violation and want to issue an official record.',
      parameters: z.object({
        residentUnit: z.string().describe('The unit number or address of the violating resident'),
        description: z.string().describe('Description of what was observed and when'),
        photoUrls: z
          .array(z.string())
          .optional()
          .describe('URLs of photos documenting the violation'),
        fineAmount: z
          .number()
          .optional()
          .describe('Fine amount in USD, if applicable per HOA bylaws'),
      }),
      execute: async ({ residentUnit, description, photoUrls, fineAmount }) => {
        // Search for applicable rule
        const ruleResults = await searchCCRs(description, hoaId, 3, 0.4)
        const ruleReference =
          ruleResults.length > 0
            ? ruleResults
                .map((r) => `${r.section_title ?? 'Section'}: ${buildPassage(r).slice(0, 400)}`)
                .join('\n\n---\n\n')
            : null

        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('violations')
          .insert({
            hoa_id: hoaId,
            reported_by: adminId,
            resident_unit: residentUnit,
            description,
            rule_reference: ruleReference,
            photo_urls: photoUrls ?? [],
            fine_amount: fineAmount ?? null,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error) return { success: false, error: 'Could not create violation record.' }

        return {
          success: true,
          violationId: data.id,
          ruleReference,
          message: `Violation record created (VIOL-${data.id.slice(0, 8).toUpperCase()}). Status: Draft. The formal notice has been prepared for review before issuing.`,
        }
      },
    }),

    issueViolation: tool({
      description: 'Mark a violation as officially issued to the resident.',
      parameters: z.object({
        violationId: z.string().describe('The UUID of the violation to issue'),
        formalNotice: z
          .string()
          .describe('The full text of the formal notice letter to be sent to the resident'),
      }),
      execute: async ({ violationId, formalNotice }) => {
        const supabase = await createClient() as Db
        const { error } = await supabase
          .from('violations')
          .update({
            status: 'issued',
            formal_notice: formalNotice,
            issued_at: new Date().toISOString(),
          })
          .eq('id', violationId)
          .eq('hoa_id', hoaId)

        if (error) return { success: false, error: 'Could not issue violation.' }
        return { success: true, violationId, status: 'issued' }
      },
    }),

    draftAnnouncement: tool({
      description: 'Create a draft announcement for the community.',
      parameters: z.object({
        subject: z.string().describe('Subject / title of the announcement'),
        body: z.string().describe('Full body text of the announcement'),
        sendEmail: z.boolean().optional().default(false).describe('Send via email to all residents'),
        sendSms: z.boolean().optional().default(false).describe('Send via SMS to all residents'),
      }),
      execute: async ({ subject, body, sendEmail, sendSms }) => {
        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('announcements')
          .insert({
            hoa_id: hoaId,
            created_by: adminId,
            subject,
            body,
            send_email: sendEmail ?? false,
            send_sms: sendSms ?? false,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error) return { success: false, error: 'Could not create announcement.' }
        return {
          success: true,
          announcementId: data.id,
          subject,
          message: `Announcement draft created (ANN-${data.id.slice(0, 8).toUpperCase()}). Review and publish from the admin dashboard.`,
        }
      },
    }),
  }
}
