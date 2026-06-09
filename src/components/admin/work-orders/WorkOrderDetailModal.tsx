'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { PhotoGallery } from '@/components/admin/PhotoGallery'
import { updateWorkOrder } from '@/app/(app)/admin/actions'
import type { WorkOrderStatus } from '@/types/database'

interface WorkOrderWithProfile {
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

interface Props {
  workOrder: WorkOrderWithProfile
  open: boolean
  onClose: () => void
}

const STATUS_OPTIONS: WorkOrderStatus[] = ['open', 'in_progress', 'resolved', 'closed']

export function WorkOrderDetailModal({ workOrder, open, onClose }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<WorkOrderStatus>(workOrder.status)
  const [notes, setNotes] = useState(workOrder.admin_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updateWorkOrder(workOrder.id, { status, admin_notes: notes })
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{workOrder.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={workOrder.priority} />
            <StatusBadge value={workOrder.status} />
            {workOrder.profiles && (
              <span className="text-muted-foreground">
                {workOrder.profiles.full_name ?? '—'}
                {workOrder.profiles.unit_number ? ` · Unit ${workOrder.profiles.unit_number}` : ''}
              </span>
            )}
            <span className="text-muted-foreground ml-auto">
              {new Date(workOrder.created_at).toLocaleDateString()}
            </span>
          </div>

          <p className="text-slate-700 whitespace-pre-wrap">{workOrder.description}</p>

          <PhotoGallery urls={workOrder.photo_urls} alt="work order photo" />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as WorkOrderStatus)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Admin Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes…"
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
