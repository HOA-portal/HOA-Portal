'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

async function requireResident() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }
  if (!profile || profile.role !== 'resident') redirect('/admin')
  return { supabase, userId: user.id, hoaId: profile.hoa_id as string }
}

export async function cancelBooking(bookingId: string): Promise<{ error?: string }> {
  const { supabase, userId } = await requireResident()

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, resident_id, date, status')
    .eq('id', bookingId)
    .eq('resident_id', userId)
    .single()

  if (fetchError || !booking) return { error: 'Booking not found.' }
  if (booking.status === 'cancelled') return { error: 'Already cancelled.' }

  const today = new Date().toISOString().split('T')[0]
  if (booking.date < today) return { error: 'Cannot cancel a past booking.' }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('resident_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/bookings')
  return {}
}
