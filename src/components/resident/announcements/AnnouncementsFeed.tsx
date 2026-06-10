'use client'

import { useState } from 'react'
import { AnnouncementDetailModal } from './AnnouncementDetailModal'

export interface ResidentAnnouncement {
  id: string
  subject: string
  body: string
  published_at: string | null
  created_at: string
}

export function AnnouncementsFeed({ announcements }: { announcements: ResidentAnnouncement[] }) {
  const [selected, setSelected] = useState<ResidentAnnouncement | null>(null)

  if (announcements.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        No announcements yet.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {announcements.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a)}
            className="w-full text-left rounded-md border border-slate-200 bg-white px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-medium text-slate-900 text-sm">{a.subject}</p>
              <p className="text-xs text-muted-foreground shrink-0">
                {new Date(a.published_at ?? a.created_at).toLocaleDateString()}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{a.body}</p>
          </button>
        ))}
      </div>

      {selected && (
        <AnnouncementDetailModal
          announcement={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
