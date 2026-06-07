import { createBrowserClient } from '@supabase/ssr'

// Database generic is applied after running: supabase gen types typescript --local > src/types/database.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
