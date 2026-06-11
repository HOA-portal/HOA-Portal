"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, ChevronLeft, ChevronRight, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ChunkItem {
  id: string
  chunk_index: number
  section_title: string | null
  content_preview: string
  content_length: number
  hierarchy_path: string | null
}

interface ChunksResponse {
  items: ChunkItem[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface DocumentChunksDrawerProps {
  documentId: string
  filename: string
  chunkCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

const LIMIT = 20

export function DocumentChunksDrawer({
  documentId,
  filename,
  chunkCount,
  open,
  onOpenChange,
}: DocumentChunksDrawerProps) {
  const [data, setData] = React.useState<ChunksResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`/api/documents/${documentId}/chunks?page=${page}&limit=${LIMIT}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error: string }) => Promise.reject(e.error)))
      .then((d: ChunksResponse) => setData(d))
      .catch((e: string) => setError(typeof e === 'string' ? e : 'Failed to load chunks'))
      .finally(() => setLoading(false))
  }, [open, documentId, page])

  // Reset page when drawer closes
  React.useEffect(() => {
    if (!open) {
      setPage(1)
      setData(null)
      setError(null)
    }
  }, [open])

  const basename = filename.replace(/\.[^/.]+$/, '')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-[600px] max-w-[95vw] bg-white shadow-2xl",
            "flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-300 ease-out"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50/80">
            <div className="flex items-start gap-3 min-w-0 pr-4">
              <div className="mt-0.5 rounded-md bg-zinc-200 p-1.5 shrink-0">
                <FileText className="h-3.5 w-3.5 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-sm font-semibold text-zinc-900 truncate leading-tight">
                  {basename}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-zinc-500 mt-0.5">
                  {chunkCount} chunks ingested
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-2">
              {loading && (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </>
              )}

              {!loading && error && (
                <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {!loading && !error && data?.total === 0 && (
                <div className="py-12 text-center text-sm text-zinc-400">
                  No chunks found.
                </div>
              )}

              {!loading && !error && data && data.items.map(chunk => (
                <ChunkCard key={chunk.id} chunk={chunk} />
              ))}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {!loading && !error && data && data.pages > 1 && (
            <div className="border-t border-zinc-100 bg-zinc-50/80 px-5 py-3 flex items-center justify-between gap-4">
              <span className="text-xs text-zinc-500 tabular-nums">
                Page {data.page} of {data.pages} &middot; {data.total} chunks
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={data.page >= data.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ChunkCard({ chunk }: { chunk: ChunkItem }) {
  return (
    <div className="rounded-md border border-zinc-100 bg-white hover:border-zinc-200 transition-colors">
      {/* Card header row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <Badge
          className="h-5 px-1.5 text-[10px] font-mono font-bold rounded bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
          variant="outline"
        >
          #{chunk.chunk_index}
        </Badge>

        {chunk.hierarchy_path && (
          <span className="text-[10px] text-blue-500/80 font-medium truncate min-w-0">
            {chunk.hierarchy_path}
          </span>
        )}
      </div>

      {/* Section title */}
      {chunk.section_title && (
        <p className="px-3 pb-1 text-xs font-semibold text-zinc-800 leading-tight">
          {chunk.section_title}
        </p>
      )}

      {/* Content preview */}
      <p className="px-3 pb-2 font-mono text-[11px] leading-relaxed text-zinc-500 break-words">
        {chunk.content_preview}
      </p>

      {/* Footer */}
      <div className="flex justify-end px-3 pb-2">
        <span className="text-[10px] text-zinc-300 tabular-nums">
          {chunk.content_length.toLocaleString()} chars
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-md border border-zinc-100 bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-8 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
      <Skeleton className="h-3 w-1/2 rounded" />
      <Skeleton className="h-12 w-full rounded" />
    </div>
  )
}
