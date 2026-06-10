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
import { toast } from 'sonner'
import { updateComplaint } from '@/app/(app)/admin/actions'
import type { ComplaintStatus } from '@/types/database'

interface ComplaintWithProfile {
  id: string
  subject: string
  description: string
  category: string
  status: ComplaintStatus
  admin_notes: string | null
  evidence_urls: string[]
  created_at: string
  profiles: { full_name: string | null; unit_number: string | null } | null
}

interface Props {
  complaint: ComplaintWithProfile
  open: boolean
  onClose: () => void
}

const STATUS_OPTIONS: ComplaintStatus[] = ['open', 'under_review', 'resolved', 'closed']

export function ComplaintDetailModal({ complaint, open, onClose }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status)
  const [notes, setNotes] = useState(complaint.admin_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updateComplaint(complaint.id, { status, admin_notes: notes })
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      toast.success('Reclamação atualizada')
      router.refresh()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{complaint.subject}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={complaint.category} />
            <StatusBadge value={complaint.status} />
            {complaint.profiles && (
              <span className="text-muted-foreground">
                {complaint.profiles.full_name ?? '—'}
                {complaint.profiles.unit_number ? ` · Unit ${complaint.profiles.unit_number}` : ''}
              </span>
            )}
            <span className="text-muted-foreground ml-auto">
              {new Date(complaint.created_at).toLocaleDateString()}
            </span>
          </div>

          <p className="text-slate-700 whitespace-pre-wrap">{complaint.description}</p>

          <PhotoGallery urls={complaint.evidence_urls} alt="evidence photo" />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as ComplaintStatus)}>
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
