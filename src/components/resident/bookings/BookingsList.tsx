'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { FilterBar } from '@/components/admin/FilterBar'
import { toast } from 'sonner'
import { cancelBooking } from '@/app/(app)/resident/actions'
import type { BookingStatus } from '@/types/database'

export interface ResidentBooking {
  id: string
  amenity_id: string
  date: string
  start_time: string
  end_time: string
  status: BookingStatus
  notes: string | null
  created_at: string
  amenities: { name: string } | null
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Cancelled', value: 'cancelled' },
]

function formatTime(time: string) {
  return new Date('1970-01-01T' + time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function BookingsList({ bookings }: { bookings: ResidentBooking[] }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('all')
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const filtered = statusFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === statusFilter)

  async function handleCancel(bookingId: string) {
    setPendingCancelId(bookingId)
    const result = await cancelBooking(bookingId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Booking cancelled')
      router.refresh()
    }
    setPendingCancelId(null)
  }

  return (
    <>
      <FilterBar
        groups={[{
          key: 'status',
          label: 'Status',
          options: STATUS_FILTERS,
          value: statusFilter,
          onChange: setStatusFilter,
        }]}
      />

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amenity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => {
                const canCancel = b.status === 'confirmed' && b.date >= today
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.amenities?.name ?? 'Unknown Amenity'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(b.start_time)} – {formatTime(b.end_time)}
                    </TableCell>
                    <TableCell><StatusBadge value={b.status} /></TableCell>
                    <TableCell className="text-right">
                      {canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                          disabled={pendingCancelId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          {pendingCancelId === b.id ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
