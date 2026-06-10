import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { BookingsList } from '@/components/resident/bookings/BookingsList'
import type { Profile } from '@/types/database'

export default async function ResidentBookingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'resident') redirect('/admin')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, amenity_id, date, start_time, end_time, status, notes, created_at, amenities (name)')
    .eq('resident_id', user.id)
    .order('date', { ascending: true })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="My Bookings"
          description="View and manage your amenity reservations."
        />
        <BookingsList bookings={(bookings ?? []) as never} />
      </div>
    </div>
  )
}
