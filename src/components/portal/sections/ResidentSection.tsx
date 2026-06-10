'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ResidentSectionProps {
  hoaSlug: string
}

export function ResidentSection({ hoaSlug }: ResidentSectionProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email or password is incorrect.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const quickLinks = [
    { label: 'HOA Fee Payments', href: '/dashboard' },
    { label: 'Amenity Reservations', href: '/dashboard' },
    { label: 'Rules, Regulations & Events', href: '/dashboard' },
  ]

  return (
    <section id="resident" className="bg-slate-800 py-14 md:py-24 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-start">
        {/* Left: info + quick links — shown second on mobile */}
        <div className="order-last md:order-first">
          <p className="text-teal-400 text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            Resident Space
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-white leading-tight">
            Already call<br />Tara Cay home?
          </h2>
          <p className="text-slate-400 mt-4 text-base leading-relaxed">
            Use these quick links for your daily association needs.
          </p>

          <div className="mt-8 space-y-3">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center justify-between w-full border border-slate-600 hover:border-teal-400 rounded-xl px-5 py-4 text-white hover:text-teal-400 transition-all group"
              >
                <span className="text-sm font-medium">{link.label}</span>
                <svg
                  className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: login card — shown first on mobile (most important CTA) */}
        <div className="order-first md:order-last bg-white rounded-2xl p-5 md:p-8 shadow-2xl">
          <h3 className="font-semibold text-slate-900 text-lg mb-5 md:mb-6">Resident Sign In</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 bg-teal-700 hover:bg-teal-600 disabled:bg-teal-700/50 text-white font-semibold py-3 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-xs text-slate-500 mt-5">
            New resident?{' '}
            <Link
              href={`/signup?hoa=${hoaSlug}`}
              className="text-teal-700 font-medium hover:text-teal-600 transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
