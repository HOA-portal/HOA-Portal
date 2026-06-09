'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { NewAnnouncementModal } from './NewAnnouncementModal'
import { publishAnnouncement, deleteAnnouncement } from '@/app/(app)/admin/actions'
import { Mail, MessageSquare, Plus } from 'lucide-react'
import type { AnnouncementStatus } from '@/types/database'

interface Announcement {
  id: string
  subject: string
  body: string
  status: AnnouncementStatus
  send_email: boolean
  send_sms: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export function AnnouncementsList({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter()
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handlePublish(id: string) {
    setPendingId(id)
    await publishAnnouncement(id)
    router.refresh()
    setPendingId(null)
  }

  async function handleDelete(id: string) {
    setPendingId(id)
    await deleteAnnouncement(id)
    router.refresh()
    setPendingId(null)
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setIsNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No announcements yet. Create one to notify your community.
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const busy = pendingId === a.id
            return (
              <Card key={a.id} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-slate-900 text-sm">{a.subject}</p>
                        <StatusBadge value={a.status} />
                        {a.send_email && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        )}
                        {a.send_sms && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" /> SMS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {a.status === 'published' && a.published_at
                          ? `Published ${new Date(a.published_at).toLocaleDateString()}`
                          : `Created ${new Date(a.created_at).toLocaleDateString()}`}
                      </p>
                    </div>

                    {a.status === 'draft' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(a.id)}
                          disabled={busy}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePublish(a.id)}
                          disabled={busy}
                        >
                          {busy ? 'Publishing…' : 'Publish'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewAnnouncementModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </>
  )
}
