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
import { WorkOrderDetailModal } from './WorkOrderDetailModal'
import type { WorkOrderStatus } from '@/types/database'

export interface WorkOrderWithProfile {
  id: string
  title: string
  description: string
  status: WorkOrderStatus
  priority: string
  photo_urls: string[]
  admin_notes: string | null
  created_at: string
  updated_at: string
  profiles: { full_name: string | null; unit_number: string | null } | null
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export function WorkOrdersTable({ workOrders }: { workOrders: WorkOrderWithProfile[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<WorkOrderWithProfile | null>(null)

  const filtered = statusFilter === 'all'
    ? workOrders
    : workOrders.filter((wo) => wo.status === statusFilter)

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
              <TableHead>Title</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No work orders found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((wo) => (
                <TableRow
                  key={wo.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(wo)}
                >
                  <TableCell className="font-medium max-w-[220px] truncate">{wo.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {wo.profiles?.full_name ?? '—'}
                    {wo.profiles?.unit_number ? ` · ${wo.profiles.unit_number}` : ''}
                  </TableCell>
                  <TableCell><StatusBadge value={wo.priority} /></TableCell>
                  <TableCell><StatusBadge value={wo.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(wo.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <WorkOrderDetailModal
          workOrder={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
