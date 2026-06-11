import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, TrendingUp, BookOpen, AlertCircle } from 'lucide-react'
import type { Profile, RagQueryLog } from '@/types/database'

const DAYS = 30

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, hoa_id')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'role' | 'hoa_id'> | null; error: unknown }

  if (!profile || profile.role !== 'admin') redirect('/chat')

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [logsRes, topSectionsRes, recentRes] = await Promise.all([
    supabase
      .from('rag_query_logs')
      .select('had_results, avg_similarity')
      .eq('hoa_id', profile.hoa_id)
      .gte('created_at', since),
    supabase
      .from('rag_query_logs')
      .select('top_section_title')
      .eq('hoa_id', profile.hoa_id)
      .eq('had_results', true)
      .not('top_section_title', 'is', null)
      .gte('created_at', since),
    supabase
      .from('rag_query_logs')
      .select('query_text, match_count, top_section_title, avg_similarity, had_results, created_at')
      .eq('hoa_id', profile.hoa_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const logs: Pick<RagQueryLog, 'had_results' | 'avg_similarity'>[] = logsRes.data ?? []
  const totalQueries = logs.length
  const withResults = logs.filter(l => l.had_results).length
  const noResultRate = totalQueries > 0 ? Math.round(((totalQueries - withResults) / totalQueries) * 100) : 0
  const simValues = logs.filter(l => l.avg_similarity !== null).map(l => l.avg_similarity as number)
  const avgSim = simValues.length > 0
    ? (simValues.reduce((a, b) => a + b, 0) / simValues.length * 100).toFixed(0)
    : null

  // Top sections
  const sectionCounts: Record<string, number> = {}
  for (const row of (topSectionsRes.data ?? [])) {
    const s = row.top_section_title!
    sectionCounts[s] = (sectionCounts[s] ?? 0) + 1
  }
  const topSections = Object.entries(sectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const recentQueries: Pick<RagQueryLog, 'query_text' | 'match_count' | 'top_section_title' | 'avg_similarity' | 'had_results' | 'created_at'>[] =
    recentRes.data ?? []

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="RAG Analytics"
          description={`Query insights for the last ${DAYS} days.`}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Search className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-muted-foreground">Total Queries</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{totalQueries}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">With Results</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{withResults}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">No-Result Rate</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{noResultRate}%</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Avg Relevance</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{avgSim !== null ? `${avgSim}%` : '—'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top sections */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Most Referenced Sections</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topSections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {topSections.map(([section, count]) => {
                    const pct = Math.round((count / withResults) * 100)
                    return (
                      <div key={section} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{section}</p>
                          <div className="mt-0.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent queries */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Queries</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No queries yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentQueries.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 truncate">{q.query_text}</p>
                        {q.top_section_title && (
                          <p className="text-[10px] text-blue-600 truncate mt-0.5">{q.top_section_title}</p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <span className={`text-[10px] font-medium ${q.had_results ? 'text-green-600' : 'text-amber-600'}`}>
                          {q.had_results ? `${q.match_count} found` : 'no match'}
                        </span>
                        {q.avg_similarity !== null && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {Math.round(q.avg_similarity * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
