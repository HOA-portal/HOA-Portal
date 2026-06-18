'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Loader2 } from 'lucide-react'

export function DlqRetryButton({ dlqId }: { dlqId: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleRetry() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/documents/dlq/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dlqId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Retry failed')
      }
      toast.success('Document re-queued for processing')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRetry} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
      {!busy && 'Retry'}
    </Button>
  )
}

export function DlqPurgeButton({ dlqId }: { dlqId: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handlePurge() {
    if (!confirm('Remove this entry from the DLQ? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/documents/dlq/purge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dlqId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Purge failed')
      }
      toast.success('DLQ entry removed')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purge failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePurge}
      disabled={busy}
      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  )
}
