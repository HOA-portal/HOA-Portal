'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Loader2, CheckCircle2, XCircle, Clock, Plus, Trash2, RefreshCw, Layers, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UploadDocumentModal } from './UploadDocumentModal'
import { DocumentChunksDrawer } from './DocumentChunksDrawer'
import type { CcrDocument } from '@/app/(app)/admin/documents/page'

const TERMINAL_STATUSES = new Set<CcrDocument['status']>(['completed', 'failed'])

const statusConfig: Record<
  CcrDocument['status'],
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    className: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  completed: {
    label: 'Ready',
    icon: CheckCircle2,
    className: 'text-green-600 bg-green-50 border-green-200',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'text-red-600 bg-red-50 border-red-200',
  },
}

export function DocumentsList({ documents }: { documents: CcrDocument[] }) {
  const router = useRouter()
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [chunksDoc, setChunksDoc] = useState<CcrDocument | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll every 3s while any document is in a non-terminal state
  useEffect(() => {
    const hasActive = documents.some(d => !TERMINAL_STATUSES.has(d.status))

    if (hasActive && !intervalRef.current) {
      intervalRef.current = setInterval(() => router.refresh(), 3000)
    } else if (!hasActive && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [documents, router])

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its indexed chunks?')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Delete failed')
      }
      toast.success('Document deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRetry(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Retry failed')
      }
      toast.success('Document re-queued for processing')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setIsUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Upload Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No documents uploaded yet. Upload a CC&R PDF to enable AI-powered rule search.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isEmptyCompleted = doc.status === 'completed' && (doc.chunk_count ?? 0) === 0
            const cfg = statusConfig[doc.status]
            const Icon = isEmptyCompleted ? AlertTriangle : cfg.icon
            const badgeClass = isEmptyCompleted
              ? 'text-amber-600 bg-amber-50 border-amber-200'
              : cfg.className
            const badgeLabel = isEmptyCompleted ? 'Empty' : cfg.label
            const busy = busyId === doc.id
            const isProcessing = doc.status === 'processing' || doc.status === 'pending'

            return (
              <Card key={doc.id} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-slate-400 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-medium text-slate-900 text-sm truncate max-w-xs">
                          {doc.filename}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                            badgeClass
                          )}
                        >
                          <Icon className={cn('h-3 w-3', isProcessing && 'animate-spin')} />
                          {badgeLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {doc.status === 'completed' && !isEmptyCompleted && (
                          <>
                            <span>{doc.chunk_count ?? 0} sections indexed</span>
                            {doc.page_count && <span>{doc.page_count} pages</span>}
                          </>
                        )}
                        {isEmptyCompleted && (
                          <span className="text-amber-600">
                            No text extracted — PDF may be scanned. Click Retry to reprocess with OCR.
                          </span>
                        )}
                        {doc.status === 'failed' && doc.error_message && (
                          <span className="text-red-500 truncate max-w-64" title={doc.error_message}>
                            {doc.error_message}
                          </span>
                        )}
                        {doc.status === 'completed' && !isEmptyCompleted && doc.processed_at && (
                          <span>Indexed {new Date(doc.processed_at).toLocaleDateString()}</span>
                        )}
                        {(doc.status === 'pending' || doc.status === 'processing') && (
                          <span>Uploaded {new Date(doc.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {doc.status === 'completed' && !isEmptyCompleted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChunksDoc(doc)}
                          title="Inspect indexed chunks"
                        >
                          <Layers className="h-3.5 w-3.5 mr-1" />
                          Chunks
                        </Button>
                      )}
                      {(doc.status === 'failed' || isEmptyCompleted) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(doc.id)}
                          disabled={busy}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        disabled={busy || isProcessing}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        title={isProcessing ? 'Cannot delete while processing' : undefined}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <UploadDocumentModal open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

      {chunksDoc && (
        <DocumentChunksDrawer
          documentId={chunksDoc.id}
          filename={chunksDoc.filename}
          chunkCount={chunksDoc.chunk_count ?? 0}
          open={chunksDoc !== null}
          onOpenChange={open => { if (!open) setChunksDoc(null) }}
        />
      )}
    </>
  )
}
