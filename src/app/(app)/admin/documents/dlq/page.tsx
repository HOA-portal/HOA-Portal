import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { DlqRetryButton, DlqPurgeButton } from '@/components/admin/documents/DlqActions'
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import type { Profile } from '@/types/database'

export default async function DlqPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  // Join with ccr_documents to get filename
  const { data: entries } = await supabase
    .from('ccr_dlq')
    .select('id, document_id, msg_id, read_ct, failed_at, last_error, retried_at, ccr_documents(filename)')
    .eq('hoa_id', profile.hoa_id)
    .order('failed_at', { ascending: false })

  type DlqEntry = {
    id: number
    document_id: string
    msg_id: number
    read_ct: number
    failed_at: string
    last_error: string | null
    retried_at: string | null
    ccr_documents: { filename: string }[] | null
  }

  const rows = (entries ?? []) as unknown as DlqEntry[]

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <div className="mb-4">
          <Link
            href="/admin/documents"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Documents
          </Link>
        </div>

        <AdminPageHeader
          title="Dead Letter Queue"
          description="Documents that failed processing after 3 attempts. Retry to reprocess or purge to remove."
        />

        {rows.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            No stuck documents — all clear.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((entry) => (
              <Card key={entry.id} className="border-red-100">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {entry.ccr_documents?.[0]?.filename ?? `Document ${entry.document_id.slice(0, 8)}…`}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{entry.read_ct} failed attempts</span>
                        <span>Failed {new Date(entry.failed_at).toLocaleString()}</span>
                        {entry.retried_at && (
                          <span className="text-amber-600">
                            Retried {new Date(entry.retried_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {entry.last_error && (
                        <p className="text-xs text-red-500 mt-1 truncate max-w-xl" title={entry.last_error}>
                          {entry.last_error}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <DlqRetryButton dlqId={entry.id} />
                      <DlqPurgeButton dlqId={entry.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
