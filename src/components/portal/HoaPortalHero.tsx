interface HoaPortalHeroProps {
  name: string
  city?: string | null
  state?: string | null
}

export function HoaPortalHero({ name, city, state }: HoaPortalHeroProps) {
  const location = [city, state].filter(Boolean).join(', ')

  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
        <span className="text-white font-bold text-2xl">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
      <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">
        {name}
      </h1>
      {location && (
        <p className="text-sky-300/80 text-sm font-medium tracking-wide uppercase">
          {location}
        </p>
      )}
    </div>
  )
}
