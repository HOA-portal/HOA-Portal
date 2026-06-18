const colors: Record<string, string> = {
  // Work order / complaint status
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  under_review: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
  // Priority
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
  // Violation status
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-orange-100 text-orange-700',
  appealed: 'bg-purple-100 text-purple-700',
  // Announcement status
  published: 'bg-green-100 text-green-700',
  // Complaint category
  noise: 'bg-rose-100 text-rose-700',
  parking: 'bg-yellow-100 text-yellow-700',
  property: 'bg-indigo-100 text-indigo-700',
  neighbor: 'bg-pink-100 text-pink-700',
  maintenance: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-600',
  // Resident status
  active: 'bg-green-100 text-green-700',
  invited: 'bg-amber-100 text-amber-700',
  inactive: 'bg-slate-100 text-slate-500',
  // Financial entry type
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-rose-100 text-rose-700',
}

export function StatusBadge({
  value,
}: {
  value: string
}) {
  const label = value.replace(/_/g, ' ')
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  )
}
