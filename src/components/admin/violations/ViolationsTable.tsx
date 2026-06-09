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
import { ViolationDetailModal } from './ViolationDetailModal'
import type { ViolationStatus } from '@/types/database'

export interface Violation {
  id: string
  description: string
  resident_unit: string | null
  status: ViolationStatus
  rule_reference: string | null
  fine_amount: number | null
  formal_notice: string | null
  photo_urls: string[]
  issued_at: string | null
  created_at: string
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Appealed', value: 'appealed' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export function ViolationsTable({ violations }: { violations: Violation[] }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Violation | null>(null)

  const filtered = statusFilter === 'all'
    ? violations
    : violations.filter((v) => v.status === statusFilter)

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
              <TableHead>Description</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fine</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No violations found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(v)}
                >
                  <TableCell className="font-medium max-w-[240px] truncate">{v.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.resident_unit ?? '—'}
                  </TableCell>
                  <TableCell><StatusBadge value={v.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.fine_amount != null ? `$${v.fine_amount.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ViolationDetailModal
          violation={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
