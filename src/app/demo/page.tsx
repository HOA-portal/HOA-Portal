import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/agent/ChatInterface'
import type { Profile } from '@/types/database'
import type { Message } from 'ai'

export const metadata = { title: 'HOA Portal — Live Demo' }

export default async function DemoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/api/demo/session')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/api/demo/session')

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('id', profile.hoa_id)
    .single() as { data: { name: string } | null; error: unknown }

  const today = new Date().toISOString().split('T')[0]

  let { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('profile_id', user.id)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { id: string } | null; error: unknown }

  if (!session) {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({ hoa_id: profile.hoa_id, profile_id: user.id })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }
    session = newSession
  }

  const initialMessages: Message[] = []

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
        You are viewing a <strong>live demo</strong> of HOA Portal.{' '}
        <a href="/signup" className="underline font-medium hover:text-amber-900">
          Create your community →
        </a>
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="font-semibold text-slate-900">Community Assistant — {hoa?.name ?? 'Sunset Ridge HOA'}</h1>
        <p className="text-sm text-muted-foreground">
          Ask about CC&amp;R rules, book amenities, submit requests, or file complaints
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatInterface
          profile={profile}
          sessionId={session?.id ?? ''}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  )
}
