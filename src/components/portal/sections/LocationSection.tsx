const columns = [
  {
    label: 'Beaches',
    icon: (
      <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    bullets: [
      'Indian Rocks Beach — 3 miles',
      'Indian Shores — walking distance',
      'Gulf Coast white sand year-round',
    ],
  },
  {
    label: 'Nature & Parks',
    icon: (
      <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    ),
    bullets: [
      'Walsingham Park — 2 miles east',
      'Trails, biking, and dog parks',
      'Peaceful natural surroundings',
    ],
  },
  {
    label: 'Connectivity',
    icon: (
      <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
    bullets: [
      'Downtown St. Pete — 20 miles',
      'Tampa International — 25 miles',
      'Major highways nearby',
    ],
  },
]

export function LocationSection() {
  return (
    <section className="bg-slate-900 py-14 md:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-16">
          <p className="text-teal-400 text-xs font-semibold tracking-[0.2em] uppercase mb-3">
            Where You&apos;ll Live
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-white">
            Prime Location
          </h2>
          <p className="text-slate-400 mt-3 text-base">
            At the center of the best the Tampa Bay region has to offer.
          </p>
        </div>

        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-700/60">
          {columns.map((col) => (
            <div key={col.label} className="py-8 md:py-0 md:px-8 first:md:pl-0 last:md:pr-0">
              {col.icon}
              <h3 className="text-white font-semibold text-base md:text-lg mt-4 mb-3">{col.label}</h3>
              <ul className="space-y-3">
                {col.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-teal-500" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
