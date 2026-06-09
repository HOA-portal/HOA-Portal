'use client'

import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
}

interface FilterGroup {
  key: string
  label?: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}

interface FilterBarProps {
  groups: FilterGroup[]
}

export function FilterBar({ groups }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {groups.map((group) => (
        <div key={group.key} className="flex items-center gap-1.5 flex-wrap">
          {group.label && (
            <span className="text-xs font-medium text-slate-500 mr-1">{group.label}:</span>
          )}
          {group.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => group.onChange(opt.value)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-medium transition-colors',
                group.value === opt.value
                  ? 'bg-primary/10 text-primary'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
