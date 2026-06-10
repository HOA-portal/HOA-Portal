import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DocumentsList } from '@/components/admin/documents/DocumentsList'
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

  const { data: documents } = await supabase
    .from('ccr_documents')
    .select('id, filename, status, page_count, chunk_count, error_message, processed_at, created_at')
    .eq('hoa_id', profile.hoa_id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="CC&R Documents"
          description="Upload and manage your community's governing documents for AI search."
        />
        <DocumentsList documents={(documents ?? []) as CcrDocument[]} />
      </div>
    </div>
  )
}
