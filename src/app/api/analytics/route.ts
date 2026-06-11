import { createClient } from '@/lib/supabase/server'
import type { Profile, RagQueryLog } from '@/types/database'

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [logsRes, topSectionsRes, dailyRes] = await Promise.all([
    // Summary stats
    supabase
      .from('rag_query_logs')
      .select('id, had_results, avg_similarity, created_at')
      .eq('hoa_id', profile.hoa_id)
      .gte('created_at', since),

    // Top sections queried
    supabase
      .from('rag_query_logs')
      .select('top_section_title')
      .eq('hoa_id', profile.hoa_id)
      .eq('had_results', true)
      .not('top_section_title', 'is', null)
      .gte('created_at', since),

    // Recent queries (last 20)
    supabase
      .from('rag_query_logs')
      .select('query_text, match_count, top_section_title, avg_similarity, had_results, created_at')
      .eq('hoa_id', profile.hoa_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const logs: Pick<RagQueryLog, 'id' | 'had_results' | 'avg_similarity' | 'created_at'>[] =
    logsRes.data ?? []

  // Compute summary
  const totalQueries = logs.length
  const queriesWithResults = logs.filter(l => l.had_results).length
  const avgSim = logs
    .filter(l => l.avg_similarity !== null)
    .reduce((sum, l, _, arr) => sum + (l.avg_similarity ?? 0) / arr.length, 0)

  // Count top sections
  const sectionCounts: Record<string, number> = {}
  for (const row of (topSectionsRes.data ?? [])) {
    const s = row.top_section_title!
    sectionCounts[s] = (sectionCounts[s] ?? 0) + 1
  }
  const topSections = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([section, count]) => ({ section, count }))

  // Queries per day (group by date string)
  const byDay: Record<string, number> = {}
  for (const log of logs) {
    const day = log.created_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  }
  const queriesPerDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  return Response.json({
    summary: {
      totalQueries,
      queriesWithResults,
      noResultRate: totalQueries > 0 ? Math.round(((totalQueries - queriesWithResults) / totalQueries) * 100) : 0,
      avgSimilarity: avgSim > 0 ? Number(avgSim.toFixed(3)) : null,
    },
    topSections,
    queriesPerDay,
    recentQueries: dailyRes.data ?? [],
  })
}
