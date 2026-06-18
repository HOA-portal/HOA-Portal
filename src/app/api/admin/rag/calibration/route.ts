import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export const maxDuration = 15

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export async function GET(): Promise<Response> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('rag_query_logs')
    .select('avg_similarity, had_results')
    .eq('hoa_id', profile.hoa_id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const total = rows?.length ?? 0
  const noResultCount = rows?.filter(r => !r.had_results).length ?? 0

  // Build sorted similarity array (exclude null rows — queries that returned no candidates)
  const similarities = (rows ?? [])
    .map(r => r.avg_similarity)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)

  const percentiles = {
    p10: Number(percentile(similarities, 10).toFixed(4)),
    p25: Number(percentile(similarities, 25).toFixed(4)),
    p50: Number(percentile(similarities, 50).toFixed(4)),
    p75: Number(percentile(similarities, 75).toFixed(4)),
    p90: Number(percentile(similarities, 90).toFixed(4)),
  }

  return Response.json({
    total,
    noResultRate: total > 0 ? Number((noResultCount / total).toFixed(4)) : 0,
    withSimilarityData: similarities.length,
    percentiles,
    // p25 blocks only the bottom 25% — a conservative starting point
    suggestedThreshold: percentiles.p25,
    currentThreshold: 0.15,
    note: 'Update matchThreshold in src/lib/ai/rag.ts after reviewing with real data.',
  })
}
