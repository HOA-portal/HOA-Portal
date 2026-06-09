'use client'

import { useState } from 'react'

export function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'buyer' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/portal/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition bg-white'

  return (
    <section id="contact" className="bg-[#F9F8F5] py-24 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-teal-700 text-xs font-semibold tracking-[0.2em] uppercase mb-3">
            Contact Us
          </p>
          <h2 className="font-display text-4xl text-slate-900">
            Let&apos;s get in touch.
          </h2>
          <p className="text-slate-500 mt-3 text-base">
            Schedule a tour or get help from the association.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-teal-100">
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 text-lg">Message sent!</h3>
            <p className="text-slate-500 mt-2 text-sm">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-4"
          >
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className={inputClass}
            >
              <option value="buyer">I am an Interested Buyer</option>
              <option value="resident">I am a Current Resident</option>
            </select>

            {status === 'error' && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                Something went wrong. Please try again or email us directly.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-teal-700 hover:bg-teal-600 disabled:bg-teal-700/50 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2"
            >
              {status === 'loading' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
