'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ResidentAnnouncement } from './AnnouncementsFeed'

interface Props {
  announcement: ResidentAnnouncement
  open: boolean
  onClose: () => void
}

export function AnnouncementDetailModal({ announcement, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{announcement.subject}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Published {new Date(announcement.published_at ?? announcement.created_at).toLocaleDateString()}
          </p>
          <p className="text-slate-700 whitespace-pre-wrap">{announcement.body}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
