import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { getAgentModel } from '@/lib/ai/model'
import { buildResidentTools } from '@/lib/ai/resident-tools'
import { buildResidentSystemPrompt } from '@/lib/ai/system-prompts'
import type { Profile, Hoa } from '@/types/database'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (profileError || !profile) {
    return new Response('Profile not found', { status: 404 })
  }

  const { data: hoa } = await supabase
    .from('hoas')
    .select('name')
    .eq('id', profile.hoa_id)
    .single() as { data: Pick<Hoa, 'name'> | null; error: unknown }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any
  try {
    parsed = await request.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }
  const { messages, sessionId } = parsed

  const result = streamText({
    model: getAgentModel(),
    system: buildResidentSystemPrompt(hoa?.name ?? 'Your Community', profile.unit_number),
    messages,
    tools: buildResidentTools(profile),
    maxSteps: 5,
    onFinish: async ({ text }) => {
      if (!sessionId || !text) return
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        hoa_id: profile.hoa_id,
        role: 'assistant',
        content: text,
      })
    },
  })

  return result.toDataStreamResponse()
}
