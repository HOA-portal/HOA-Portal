const amenities = [
  {
    title: 'Two Heated Pools',
    description:
      'Relax year-round in beautifully maintained heated pools, open to all residents and their guests. Perfect for Florida living at its finest.',
    icon: (
      <svg className="w-10 h-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.5c.83 0 1.5-.67 1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m6 0c.83 0 1.5-.67 1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m-3-5V4m0 0-2 2m2-2 2 2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19.5c.83 0 1.5-.67 1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m6 0c.83 0 1.5-.67 1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m6-4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5m0 4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5" />
      </svg>
    ),
  },
  {
    title: 'Waterfront & Boating Access',
    description:
      'Community boat ramp, dock, and select units with private boat slips on the Intracoastal Waterway — because life is better on the water.',
    icon: (
      <svg className="w-10 h-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 19.5c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5M12 3l-3.5 9h7L12 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 12 3.75 16.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 12l1.5 4.5" />
      </svg>
    ),
  },
  {
    title: 'Clubhouse & Community Spaces',
    description:
      'Association spaces for events, gatherings, and everything that makes Tara Cay feel like home. Where neighbors become friends.',
    icon: (
      <svg className="w-10 h-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
]

export function AmenitiesSection() {
  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-teal-700 text-xs font-semibold tracking-[0.2em] uppercase mb-3">
            What You Get
          </p>
          <h2 className="font-display text-4xl text-slate-900">
            Premium Amenities
          </h2>
          <p className="text-slate-500 mt-3 text-base">
            Designed for those who love the sun and the water.
          </p>
        </div>

        <div className="space-y-4">
          {amenities.map((amenity) => (
            <div
              key={amenity.title}
              className="flex items-start gap-6 p-8 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all bg-white group"
            >
              <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-teal-50 group-hover:bg-teal-100 transition-colors flex items-center justify-center">
                {amenity.icon}
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-slate-900 text-lg">{amenity.title}</h3>
                <p className="text-slate-500 mt-1.5 text-sm leading-relaxed max-w-2xl">
                  {amenity.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
