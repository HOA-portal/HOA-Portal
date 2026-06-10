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
import type { WorkOrderStatus, WorkOrderPriority } from '@/types/database'

export interface ResidentWorkOrder {
  id: string
  title: string
  description: string
  status: WorkOrderStatus
  priority: WorkOrderPriority
  photo_urls: string[]
  admin_notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export function WorkOrdersList({ workOrders }: { workOrders: ResidentWorkOrder[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<ResidentWorkOrder | null>(null)

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
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
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
                  <TableCell className="font-medium max-w-[280px] truncate">{wo.title}</TableCell>
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
