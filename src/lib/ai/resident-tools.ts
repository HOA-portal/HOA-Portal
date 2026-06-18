import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { searchCCRs, buildPassage } from './rag'
import type { Profile } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export function buildResidentTools(profile: Profile) {
  const { hoa_id: hoaId, id: userId } = profile

  return {
    searchHOARules: tool({
      description:
        'Search the community CC&Rs and rules for relevant sections. Use this for any question about HOA rules, restrictions, or guidelines.',
      parameters: z.object({
        query: z.string().describe('The question or topic to search for in the HOA rules'),
      }),
      execute: async ({ query }) => {
        const supabase = await createClient() as Db
        const chunks = await searchCCRs(query, hoaId)
        if (chunks.length === 0) {
          // Distinguish between "no documents ingested" and "no relevant section found"
          const { count } = await supabase
            .from('ccr_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('hoa_id', hoaId)
          if ((count ?? 0) === 0) {
            return {
              found: false,
              reason: 'no_documents',
              message: "The community's CC&R documents haven't been uploaded or processed yet. Ask your HOA admin to upload the documents.",
            }
          }
          return {
            found: false,
            reason: 'no_match',
            message: "No relevant rules were found for that specific query. The CC&Rs may not cover this topic, or try rephrasing the question.",
          }
        }
        return {
          found: true,
          results: chunks.map((c) => ({
            section: c.section_title ?? 'General Rules',
            content: buildPassage(c),
          })),
        }
      },
    }),

    listAmenities: tool({
      description: 'List all available amenities in the community.',
      parameters: z.object({}),
      execute: async () => {
        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('amenities')
          .select('id, name, description, capacity, rules')
          .eq('hoa_id', hoaId)
          .eq('is_active', true)
          .order('name')

        if (error) return { error: 'Could not load amenities.' }
        return { amenities: data ?? [] }
      },
    }),

    checkAmenityAvailability: tool({
      description:
        'Check if an amenity is available on a specific date. Returns existing bookings for that day.',
      parameters: z.object({
        amenityId: z.string().describe('The UUID of the amenity to check'),
        date: z.string().describe('The date to check in YYYY-MM-DD format'),
      }),
      execute: async ({ amenityId, date }) => {
        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('bookings')
          .select('start_time, end_time, status')
          .eq('amenity_id', amenityId)
          .eq('hoa_id', hoaId)
          .eq('date', date)
          .eq('status', 'confirmed')
          .order('start_time')

        if (error) return { error: 'Could not check availability.' }

        return {
          date,
          existingBookings: (data ?? []).map((b: { start_time: string; end_time: string }) => ({
            startTime: b.start_time,
            endTime: b.end_time,
          })),
          available: (data ?? []).length === 0,
        }
      },
    }),

    bookAmenity: tool({
      description: 'Book an amenity for the resident on a specific date and time.',
      parameters: z.object({
        amenityId: z.string().describe('The UUID of the amenity to book'),
        date: z.string().describe('The booking date in YYYY-MM-DD format'),
        startTime: z.string().describe('Start time in HH:MM format (24h)'),
        endTime: z.string().describe('End time in HH:MM format (24h)'),
        notes: z.string().optional().describe('Optional notes for the booking'),
      }),
      execute: async ({ amenityId, date, startTime, endTime, notes }) => {
        const supabase = await createClient() as Db

        // Verify no conflict
        const { data: conflicts } = await supabase
          .from('bookings')
          .select('id')
          .eq('amenity_id', amenityId)
          .eq('hoa_id', hoaId)
          .eq('date', date)
          .eq('status', 'confirmed')
          .lt('start_time', endTime)
          .gt('end_time', startTime)

        if (conflicts && conflicts.length > 0) {
          return {
            success: false,
            error: 'That time slot is already booked. Please choose a different time.',
          }
        }

        const { data, error } = await supabase
          .from('bookings')
          .insert({
            hoa_id: hoaId,
            amenity_id: amenityId,
            resident_id: userId,
            date,
            start_time: startTime,
            end_time: endTime,
            notes: notes ?? null,
            status: 'confirmed',
          })
          .select('id')
          .single()

        if (error) {
          return { success: false, error: 'Booking failed. Please try again.' }
        }

        return {
          success: true,
          bookingId: data.id,
          date,
          startTime,
          endTime,
        }
      },
    }),

    submitWorkOrder: tool({
      description:
        'Submit a maintenance work order on behalf of the resident. Use this when a resident reports a maintenance issue or repair need.',
      parameters: z.object({
        title: z.string().describe('A short title for the work order (e.g., "Broken pool gate latch")'),
        description: z
          .string()
          .describe('Detailed description of the issue, location, and any relevant context'),
        priority: z
          .enum(['low', 'medium', 'high', 'urgent'])
          .describe('Priority level based on urgency and safety impact'),
        photoUrls: z
          .array(z.string())
          .optional()
          .describe('URLs of photos the resident attached'),
      }),
      execute: async ({ title, description, priority, photoUrls }) => {
        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('work_orders')
          .insert({
            hoa_id: hoaId,
            submitted_by: userId,
            title,
            description,
            priority,
            photo_urls: photoUrls ?? [],
            status: 'open',
          })
          .select('id')
          .single()

        if (error) {
          return { success: false, error: 'Failed to submit work order. Please try again.' }
        }

        return {
          success: true,
          workOrderId: data.id,
          title,
          priority,
          message: `Work order submitted successfully. Reference: WO-${data.id.slice(0, 8).toUpperCase()}`,
        }
      },
    }),

    fileComplaint: tool({
      description:
        'File a formal complaint to the HOA board. Use this when a resident wants to officially report an issue involving another resident, a rule violation they witnessed, or a community problem.',
      parameters: z.object({
        subject: z.string().describe('Brief subject line for the complaint'),
        description: z
          .string()
          .describe(
            'Full description of the complaint including when it happened, who was involved (without personal details), and what the impact was'
          ),
        category: z
          .enum(['noise', 'parking', 'property', 'neighbor', 'maintenance', 'other'])
          .describe('Category that best describes this complaint'),
        evidenceUrls: z
          .array(z.string())
          .optional()
          .describe('URLs of any photos or evidence attached'),
      }),
      execute: async ({ subject, description, category, evidenceUrls }) => {
        const supabase = await createClient() as Db
        const { data, error } = await supabase
          .from('complaints')
          .insert({
            hoa_id: hoaId,
            submitted_by: userId,
            subject,
            description,
            category,
            evidence_urls: evidenceUrls ?? [],
            status: 'open',
          })
          .select('id')
          .single()

        if (error) {
          return { success: false, error: 'Failed to file complaint. Please try again.' }
        }

        return {
          success: true,
          complaintId: data.id,
          subject,
          category,
          message: `Your complaint has been filed. Reference: COMP-${data.id.slice(0, 8).toUpperCase()}. The HOA board will review it and respond within 5 business days.`,
        }
      },
    }),

    getMyWorkOrders: tool({
      description: "Get the resident's recent work orders and their current status.",
      parameters: z.object({
        status: z
          .enum(['open', 'in_progress', 'resolved', 'closed', 'all'])
          .optional()
          .default('all')
          .describe('Filter by status'),
      }),
      execute: async ({ status }) => {
        const supabase = await createClient() as Db
        let query = supabase
          .from('work_orders')
          .select('id, title, status, priority, created_at')
          .eq('hoa_id', hoaId)
          .eq('submitted_by', userId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (status !== 'all') {
          query = query.eq('status', status)
        }

        const { data, error } = await query
        if (error) return { error: 'Could not load work orders.' }
        return { workOrders: data ?? [] }
      },
    }),

    getMyBookings: tool({
      description: "Get the resident's upcoming amenity bookings.",
      parameters: z.object({}),
      execute: async () => {
        const supabase = await createClient() as Db
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('bookings')
          .select('id, date, start_time, end_time, status, amenities(name)')
          .eq('hoa_id', hoaId)
          .eq('resident_id', userId)
          .gte('date', today)
          .eq('status', 'confirmed')
          .order('date')
          .limit(10)

        if (error) return { error: 'Could not load bookings.' }
        return { bookings: data ?? [] }
      },
    }),

    queryHOAFinancials: tool({
      description:
        'Consulta as finanças do condomínio. Use para perguntas sobre saldo atual, resumo mensal (receitas/despesas de um mês), gastos por categoria ou lista de lançamentos. Exemplos: "Qual é o saldo do condomínio?", "Quanto foi gasto em manutenção em março?", "Quais foram as despesas de junho de 2025?".',
      parameters: z.object({
        queryType: z
          .enum(['current_balance', 'period_summary', 'category_breakdown', 'entry_list'])
          .describe(
            'Tipo de consulta: current_balance = saldo geral acumulado; period_summary = totais de um mês específico; category_breakdown = gastos por categoria em um mês; entry_list = lançamentos detalhados de um mês',
          ),
        year: z.number().optional().describe('Ano (ex: 2025). Obrigatório para period_summary, category_breakdown e entry_list.'),
        month: z.number().min(1).max(12).optional().describe('Mês como número 1-12. Obrigatório para period_summary, category_breakdown e entry_list.'),
        category: z.string().optional().describe('Nome da categoria para filtrar (ex: "Manutenção"). Usado em entry_list.'),
      }),
      execute: async ({ queryType, year, month, category }) => {
        const supabase = await createClient() as Db

        if (queryType === 'current_balance') {
          const { data: periods, error } = await supabase
            .from('financial_periods')
            .select('year, month, status, total_income, total_expenses')
            .eq('hoa_id', hoaId)
            .order('year', { ascending: false })
            .order('month', { ascending: false })

          if (error) return { error: 'Não foi possível carregar o saldo financeiro.' }
          if (!periods?.length) {
            return { found: false, message: 'Nenhum período financeiro foi registrado ainda. Consulte o administrador do condomínio.' }
          }

          const totalIncome = periods.reduce((s: number, p: { total_income: number }) => s + Number(p.total_income), 0)
          const totalExpenses = periods.reduce((s: number, p: { total_expenses: number }) => s + Number(p.total_expenses), 0)
          const balance = totalIncome - totalExpenses
          const openPeriod = periods.find((p: { status: string }) => p.status === 'open')

          return {
            found: true,
            balance,
            totalIncome,
            totalExpenses,
            periodCount: periods.length,
            currentOpenPeriod: openPeriod
              ? { year: openPeriod.year, month: openPeriod.month }
              : null,
          }
        }

        if (queryType === 'period_summary') {
          if (!year || !month) return { error: 'Ano e mês são necessários para consultar um período específico.' }

          const { data: period, error } = await supabase
            .from('financial_periods')
            .select('id, status, total_income, total_expenses')
            .eq('hoa_id', hoaId)
            .eq('year', year)
            .eq('month', month)
            .single()

          if (error || !period) {
            return { found: false, message: `Nenhum período financeiro encontrado para ${month}/${year}.` }
          }

          return {
            found: true,
            year,
            month,
            status: period.status,
            totalIncome: Number(period.total_income),
            totalExpenses: Number(period.total_expenses),
            balance: Number(period.total_income) - Number(period.total_expenses),
          }
        }

        if (queryType === 'category_breakdown') {
          if (!year || !month) return { error: 'Ano e mês são necessários.' }

          const { data: period } = await supabase
            .from('financial_periods')
            .select('id')
            .eq('hoa_id', hoaId)
            .eq('year', year)
            .eq('month', month)
            .single()

          if (!period) return { found: false, message: `Nenhum período encontrado para ${month}/${year}.` }

          const { data: entries, error } = await supabase
            .from('financial_entries')
            .select('type, amount, financial_categories(name)')
            .eq('period_id', period.id)

          if (error) return { error: 'Não foi possível carregar os lançamentos.' }

          const byCategory: Record<string, { type: string; total: number }> = {}
          for (const entry of (entries ?? [])) {
            const catName = (entry.financial_categories as { name: string } | null)?.name ?? 'Outros'
            if (!byCategory[catName]) byCategory[catName] = { type: entry.type, total: 0 }
            byCategory[catName].total += Number(entry.amount)
          }

          return {
            found: true,
            year,
            month,
            categories: Object.entries(byCategory)
              .map(([name, v]) => ({ name, type: v.type, total: v.total }))
              .sort((a, b) => b.total - a.total),
          }
        }

        if (queryType === 'entry_list') {
          if (!year || !month) return { error: 'Ano e mês são necessários.' }

          const { data: period } = await supabase
            .from('financial_periods')
            .select('id')
            .eq('hoa_id', hoaId)
            .eq('year', year)
            .eq('month', month)
            .single()

          if (!period) return { found: false, message: `Nenhum período encontrado para ${month}/${year}.` }

          const { data: entries, error } = await supabase
            .from('financial_entries')
            .select('type, description, amount, entry_date, vendor, financial_categories(name)')
            .eq('period_id', period.id)
            .order('entry_date', { ascending: true })

          if (error) return { error: 'Não foi possível carregar os lançamentos.' }

          let result = entries ?? []
          if (category) {
            const lower = category.toLowerCase()
            result = result.filter((e: { financial_categories: { name: string } | null }) =>
              ((e.financial_categories as { name: string } | null)?.name ?? '').toLowerCase().includes(lower),
            )
          }

          return {
            found: true,
            year,
            month,
            entries: result.map((e: {
              type: string
              description: string
              amount: number
              entry_date: string
              vendor: string | null
              financial_categories: { name: string } | null
            }) => ({
              type: e.type,
              description: e.description,
              amount: Number(e.amount),
              date: e.entry_date,
              vendor: e.vendor,
              category: (e.financial_categories as { name: string } | null)?.name ?? 'Outros',
            })),
          }
        }

        return { error: 'Tipo de consulta não reconhecido.' }
      },
    }),
  }
}
