import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/agent/ChatInterface'
import type { Profile } from '@/types/database'
import type { Message } from 'ai'

export default async function ChatPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  // Get or create today's chat session
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

  // Load recent messages for this session
  const initialMessages: Message[] = []
  if (session) {
    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(50) as { data: Array<{ id: string; role: string; content: string; created_at: string }> | null; error: unknown }

    if (dbMessages) {
      for (const msg of dbMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          initialMessages.push({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="font-semibold text-slate-900">Community Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions, book amenities, submit requests, or file complaints
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
