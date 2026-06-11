'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface ImportResult {
  email: string
  status: 'created' | 'skipped' | 'error'
  reason?: string
}

interface ImportSummary {
  created: number
  skipped: number
  errors: number
  results: ImportResult[]
}

export function ResidentImportForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setError(null)
    setSummary(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a CSV file.'); return }

    setLoading(true)
    setError(null)
    setSummary(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/admin/residents/import', {
      method: 'POST',
      body: form,
    })

    const body = await res.json()

    if (!res.ok) {
      setError(body.error ?? 'Import failed. Please try again.')
      setLoading(false)
      return
    }

    setSummary(body)
    setLoading(false)

    if (body.created > 0) {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          CSV file
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />
        {file && (
          <p className="mt-2 text-xs text-slate-500">{file.name} — {(file.size / 1024).toFixed(1)} KB</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      {summary && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <p className="font-medium text-sm text-slate-900">
              Import complete — {summary.created} invited, {summary.skipped} skipped, {summary.errors} errors
            </p>
          </div>
          {summary.results.filter((r) => r.status !== 'created').length > 0 && (
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {summary.results
                .filter((r) => r.status !== 'created')
                .map((r, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{r.email}</span>
                    <span className={`text-xs font-medium ${r.status === 'skipped' ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.reason ?? r.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <Button type="submit" disabled={loading || !file} className="w-full">
        {loading ? 'Importing…' : 'Import and send invitations'}
      </Button>
    </form>
  )
}
