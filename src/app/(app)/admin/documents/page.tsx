import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DocumentsList } from '@/components/admin/documents/DocumentsList'
import { AlertTriangle } from 'lucide-react'
import type { Profile, CcrDocument } from '@/types/database'

export type { CcrDocument }

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const [{ data: documents }, { count: dlqCount }] = await Promise.all([
    supabase
      .from('ccr_documents')
      .select('id, filename, status, page_count, chunk_count, error_message, processed_at, created_at, progress_pct, version')
      .eq('hoa_id', profile.hoa_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ccr_dlq')
      .select('*', { count: 'exact', head: true })
      .eq('hoa_id', profile.hoa_id),
  ])

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <div className="flex items-start justify-between mb-6">
          <AdminPageHeader
            title="CC&R Documents"
            description="Upload and manage your community's governing documents for AI search."
          />
          {(dlqCount ?? 0) > 0 && (
            <Link
              href="/admin/documents/dlq"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1 hover:bg-red-100 shrink-0"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {dlqCount} stuck
            </Link>
          )}
        </div>
        <DocumentsList documents={(documents ?? []) as CcrDocument[]} />
      </div>
    </div>
  )
}
