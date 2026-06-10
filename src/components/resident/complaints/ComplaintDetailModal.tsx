'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { PhotoGallery } from '@/components/admin/PhotoGallery'
import type { ResidentComplaint } from './ComplaintsList'

interface Props {
  complaint: ResidentComplaint
  open: boolean
  onClose: () => void
}

export function ComplaintDetailModal({ complaint, open, onClose }: Props) {
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
            <span className="text-muted-foreground ml-auto">
              {new Date(complaint.created_at).toLocaleDateString()}
            </span>
          </div>

          <p className="text-slate-700 whitespace-pre-wrap">{complaint.description}</p>

          <PhotoGallery urls={complaint.evidence_urls} alt="complaint evidence" />

          {complaint.admin_notes && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Response from HOA</p>
              <p className="text-slate-700 bg-slate-50 rounded-md px-3 py-2 whitespace-pre-wrap">
                {complaint.admin_notes}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
