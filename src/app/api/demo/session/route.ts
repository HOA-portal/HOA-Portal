import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEMO_EMAIL = 'demo@hoa-portal.app'
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'demo-password'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })

  if (error) {
    return new Response(
      'Demo environment not available. Please try again later.',
      { status: 503 }
    )
  }

  return NextResponse.redirect(`${origin}/demo`)
}
