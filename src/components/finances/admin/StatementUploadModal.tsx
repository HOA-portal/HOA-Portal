'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedStatement } from '@/lib/ai/financial-parser-types'

interface Props {
  open: boolean
  onClose: () => void
  onParsed: (statementId: string, parsed: ParsedStatement) => void
}

export function StatementUploadModal({ open, onClose, onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'parsing'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted')
      return
    }
    setFile(selected)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      if (!dropped.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Only PDF files are accepted')
        return
      }
      setFile(dropped)
    }
  }

  function handleClose() {
    if (phase !== 'idle') return
    setFile(null)
    setUploadProgress(0)
    onClose()
  }

  async function handleUpload() {
    if (!file) return
    setPhase('uploading')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 85))
      }
    })

    // Bytes fully sent — server is now parsing with Claude (can take 10-30s)
    xhr.upload.addEventListener('load', () => {
      setPhase('parsing')
      setUploadProgress(90)
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        setPhase('parsing')
        setUploadProgress(100)
        try {
          const body = JSON.parse(xhr.responseText)
          toast.success('Statement analyzed successfully')
          setFile(null)
          setUploadProgress(0)
          setPhase('idle')
          onClose()
          onParsed(body.id, body.parsed)
        } catch {
          toast.error('Invalid server response')
          setPhase('idle')
        }
      } else {
        let message = 'Error processing statement. Please try again.'
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.error) message = body.error
        } catch {}
        toast.error(message)
        setPhase('idle')
      }
    })

    xhr.addEventListener('error', () => {
      toast.error('Network error. Check your connection and try again.')
      setPhase('idle')
    })

    xhr.open('POST', '/api/admin/finances/statements/upload')
    xhr.send(formData)
  }

  const busy = phase !== 'idle'
  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Financial Statement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Upload the monthly PDF from your property management company. The system will automatically extract entries for review.
          </p>

          <div
            onClick={() => !busy && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              busy
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                : 'border-slate-300 hover:border-primary/60 hover:bg-primary/5 cursor-pointer'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />

            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-48">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fileSizeMB} MB</p>
                </div>
                {!busy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="ml-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  Drag or <span className="text-primary font-medium">select</span> the PDF
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF only, up to 20 MB</p>
              </div>
            )}
          </div>

          {busy && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{phase === 'uploading' ? 'Uploading…' : 'Analyzing with AI…'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {phase === 'parsing' && (
                <p className="text-xs text-muted-foreground">
                  Extracting entries automatically…
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || busy}>
              {busy ? 'Processing…' : 'Analyze PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
