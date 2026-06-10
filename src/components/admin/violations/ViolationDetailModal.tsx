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
import { issueViolation, updateViolationStatus } from '@/app/(app)/admin/actions'
import type { ViolationStatus } from '@/types/database'

interface Violation {
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

interface Props {
  violation: Violation
  open: boolean
  onClose: () => void
}

const NON_DRAFT_STATUS_OPTIONS: ViolationStatus[] = ['appealed', 'resolved', 'closed']

export function ViolationDetailModal({ violation, open, onClose }: Props) {
  const router = useRouter()
  const [formalNotice, setFormalNotice] = useState(violation.formal_notice ?? '')
  const [status, setStatus] = useState<ViolationStatus>(violation.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDraft = violation.status === 'draft'

  async function handleIssue() {
    if (!formalNotice.trim()) return
    setSaving(true)
    setError(null)
    const result = await issueViolation(violation.id, formalNotice.trim())
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      toast.success('Infração registrada')
      router.refresh()
      onClose()
    }
  }

  async function handleUpdateStatus() {
    setSaving(true)
    setError(null)
    const result = await updateViolationStatus(violation.id, status)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      toast.success('Status atualizado')
      router.refresh()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Violation Detail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={violation.status} />
            {violation.resident_unit && (
              <span className="text-muted-foreground">Unit {violation.resident_unit}</span>
            )}
            {violation.fine_amount != null && (
              <span className="text-muted-foreground font-medium">
                Fine: ${violation.fine_amount.toFixed(2)}
              </span>
            )}
            <span className="text-muted-foreground ml-auto">
              {new Date(violation.created_at).toLocaleDateString()}
            </span>
          </div>

          <p className="text-slate-700 whitespace-pre-wrap">{violation.description}</p>

          {violation.rule_reference && (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Rule Reference</p>
              <p className="text-slate-700">{violation.rule_reference}</p>
            </div>
          )}

          <PhotoGallery urls={violation.photo_urls} alt="violation photo" />

          {isDraft ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Formal Notice <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formalNotice}
                onChange={(e) => setFormalNotice(e.target.value)}
                placeholder="Write the formal notice to be sent to the resident…"
                rows={5}
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Required before issuing. Include violation description, rule reference, corrective action, and deadline.
              </p>
            </div>
          ) : (
            <>
              {violation.formal_notice && (
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Formal Notice</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{violation.formal_notice}</p>
                  {violation.issued_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Issued {new Date(violation.issued_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Update Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as ViolationStatus)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NON_DRAFT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            {isDraft ? (
              <Button
                size="sm"
                onClick={handleIssue}
                disabled={saving || !formalNotice.trim()}
              >
                {saving ? 'Issuing…' : 'Issue Violation'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleUpdateStatus}
                disabled={saving || status === violation.status}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
