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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { createAnnouncement } from '@/app/(app)/admin/actions'

interface Props {
  open: boolean
  onClose: () => void
}

export function NewAnnouncementModal({ open, onClose }: Props) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [sendSms, setSendSms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!subject.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    const result = await createAnnouncement({
      subject: subject.trim(),
      body: body.trim(),
      send_email: sendEmail,
      send_sms: sendSms,
    })
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      toast.success('Comunicado criado')
      router.refresh()
      onClose()
    }
  }

  function handleClose() {
    if (!saving) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">New Announcement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Pool Closure — Dec 15"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Body <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement…"
              rows={6}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Notify residents via</p>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(v) => setSendEmail(!!v)}
                />
                <span className="text-sm">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendSms}
                  onCheckedChange={(v) => setSendSms(!!v)}
                />
                <span className="text-sm">SMS</span>
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving || !subject.trim() || !body.trim()}
            >
              {saving ? 'Saving…' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
