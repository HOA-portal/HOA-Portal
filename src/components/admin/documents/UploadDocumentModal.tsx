'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
}

export function UploadDocumentModal({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setProgress(0)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleClose() {
    if (uploading) return
    setFile(null)
    setProgress(0)
    onClose()
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    // Use XHR instead of fetch to get upload progress events
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      setUploading(false)
      if (xhr.status === 202) {
        toast.success('Document uploaded — processing will begin shortly.')
        setFile(null)
        setProgress(0)
        router.refresh()
        onClose()
      } else {
        let message = 'Upload failed. Please try again.'
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.error) message = body.error
        } catch {}
        toast.error(message)
      }
    })

    xhr.addEventListener('error', () => {
      setUploading(false)
      toast.error('Network error. Please check your connection and try again.')
    })

    xhr.open('POST', '/api/documents/upload')
    xhr.send(formData)
  }

  const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload CC&R Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Drop zone */}
          <div
            onClick={() => !uploading && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              uploading
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                : 'border-slate-300 hover:border-primary/60 hover:bg-primary/5'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-48">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{fileSizeMB} MB</p>
                </div>
                {!uploading && (
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
                  Drag & drop or <span className="text-primary font-medium">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF or image, up to 50 MB</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                After upload, document processing (OCR + embedding) begins automatically.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
