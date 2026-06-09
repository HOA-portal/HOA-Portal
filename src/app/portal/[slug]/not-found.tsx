import Link from 'next/link'

export default function PortalNotFound() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950" />

      <div className="relative z-10 text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <span className="text-slate-400 text-2xl">?</span>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">Community not found</h1>
        <p className="text-slate-400 text-sm mb-8">
          We couldn&apos;t find a community with that address. Check the URL or contact your HOA administrator.
        </p>
        <Link
          href="/"
          className="inline-block bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium px-6 py-3 rounded-xl transition-all"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
