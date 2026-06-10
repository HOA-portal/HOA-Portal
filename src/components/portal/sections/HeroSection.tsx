import Image from 'next/image'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with fallback */}
      <div className="absolute inset-0 bg-slate-700">
        <Image
          src="/images/tara-cay/exterior.jpg"
          alt="Tara Cay Townhomes"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/20" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <p className="text-teal-300 text-xs font-semibold tracking-[0.25em] uppercase mb-4 md:mb-8">
          Seminole, Florida · Intracoastal Waterfront
        </p>
        <h1 className="font-display text-4xl sm:text-6xl md:text-8xl text-white leading-[1.05] tracking-tight">
          Welcome to<br />Tara Cay
        </h1>
        <p className="text-base md:text-xl text-white/75 mt-5 md:mt-6 max-w-lg mx-auto leading-relaxed font-light">
          Where Florida charm meets the waterfront lifestyle.
        </p>
        <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#contact"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/20"
          >
            View Available Units
          </a>
          <a
            href="#resident"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-white/50 text-white text-sm font-semibold rounded-xl hover:bg-white/10 hover:border-white/70 transition-all"
          >
            Resident Portal
          </a>
        </div>
      </div>

      {/* Bottom fade to white */}
      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  )
}
