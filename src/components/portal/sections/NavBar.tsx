'use client'

export function NavBar({ hoaName }: { hoaName: string }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">TC</span>
          </div>
          <span className="font-semibold text-slate-900 text-sm truncate">{hoaName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => scrollTo('contact')}
            className="hidden sm:inline-flex px-4 py-2.5 text-sm font-medium text-teal-700 border border-teal-700 rounded-lg hover:bg-teal-50 transition-colors"
          >
            View Available Units
          </button>
          <button
            onClick={() => scrollTo('resident')}
            className="inline-flex px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors"
          >
            Resident Portal
          </button>
        </div>
      </div>
    </nav>
  )
}
