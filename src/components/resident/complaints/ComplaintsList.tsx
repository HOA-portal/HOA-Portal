'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { FilterBar } from '@/components/admin/FilterBar'
import { ComplaintDetailModal } from './ComplaintDetailModal'
import type { ComplaintStatus, ComplaintCategory } from '@/types/database'

export interface ResidentComplaint {
  id: string
  subject: string
  description: string
  category: ComplaintCategory
  status: ComplaintStatus
  admin_notes: string | null
  evidence_urls: string[]
  created_at: string
  updated_at: string
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

const CATEGORY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Noise', value: 'noise' },
  { label: 'Parking', value: 'parking' },
  { label: 'Property', value: 'property' },
  { label: 'Neighbor', value: 'neighbor' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Other', value: 'other' },
]

export function ComplaintsList({ complaints }: { complaints: ResidentComplaint[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selected, setSelected] = useState<ResidentComplaint | null>(null)

  const filtered = complaints.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    return true
  })

  return (
    <>
      <FilterBar
        groups={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_FILTERS,
            value: statusFilter,
            onChange: setStatusFilter,
          },
          {
            key: 'category',
            label: 'Category',
            options: CATEGORY_FILTERS,
            value: categoryFilter,
            onChange: setCategoryFilter,
          },
        ]}
      />

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No complaints found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="font-medium max-w-[280px] truncate">{c.subject}</TableCell>
                  <TableCell><StatusBadge value={c.category} /></TableCell>
                  <TableCell><StatusBadge value={c.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ComplaintDetailModal
          complaint={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
