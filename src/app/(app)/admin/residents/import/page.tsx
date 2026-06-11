import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { ResidentImportForm } from '@/components/admin/residents/ResidentImportForm'
import type { Profile } from '@/types/database'

export default async function ResidentsImportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 max-w-2xl">
        <AdminPageHeader
          title="Import Residents"
          description="Upload a CSV file to invite multiple residents at once."
          action={
            <Link href="/admin/residents">
              <Button variant="outline" size="sm">Back to Residents</Button>
            </Link>
          }
        />

        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">CSV format</h2>
          <p className="text-sm text-slate-500 mb-3">
            The file must have an <code className="bg-slate-100 px-1 rounded text-xs">email</code> column.
            All other columns are optional but recommended.
          </p>
          <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700 overflow-x-auto">
            {`full_name,email,unit_number,phone\nJohn Doe,john@example.com,4B,+15550001111\nJane Smith,jane@example.com,5A,`}
          </pre>
        </div>

        <ResidentImportForm />
      </div>
    </div>
  )
}
