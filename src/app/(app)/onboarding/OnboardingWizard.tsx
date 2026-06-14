'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Check, Copy, ExternalLink, ChevronRight, Users, FileText, CalendarDays, CheckCircle2 } from 'lucide-react'

interface Props {
  hoaName: string
  subdomain: string
  adminName: string
  appUrl: string
}

interface Amenity { id: string; name: string; capacity: number | null }

type Step = 1 | 2 | 3 | 4

const STEPS = [
  { id: 1, label: 'Welcome', icon: CheckCircle2 },
  { id: 2, label: 'CC&R Docs', icon: FileText },
  { id: 3, label: 'Amenities', icon: CalendarDays },
  { id: 4, label: 'Residents', icon: Users },
]

export default function OnboardingWizard({ hoaName, subdomain, adminName, appUrl }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [copied, setCopied] = useState(false)
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [amenityForm, setAmenityForm] = useState({ name: '', capacity: '' })
  const [addingAmenity, setAddingAmenity] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const signupUrl = `${appUrl}/signup`

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function addAmenity() {
    if (!amenityForm.name.trim()) return
    setAddingAmenity(true)
    const res = await fetch('/api/admin/amenities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: amenityForm.name.trim(),
        capacity: amenityForm.capacity ? Number(amenityForm.capacity) : null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setAmenities((prev) => [...prev, created])
      setAmenityForm({ name: '', capacity: '' })
    }
    setAddingAmenity(false)
  }

  async function removeAmenity(id: string) {
    await fetch(`/api/admin/amenities/${id}`, { method: 'DELETE' })
    setAmenities((prev) => prev.filter((a) => a.id !== id))
  }

  async function finish() {
    setFinishing(true)
    await fetch('/api/onboarding/complete', { method: 'PATCH' })
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-12 px-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((s, i) => {
          const done = step > s.id
          const active = step === s.id
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                done ? 'bg-primary text-primary-foreground' :
                active ? 'bg-primary/20 text-primary border-2 border-primary' :
                'bg-slate-200 text-slate-500'
              }`}>
                {done ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-300 mx-1" />}
            </div>
          )
        })}
      </div>

      <div className="w-full max-w-xl">
        {/* ─── Step 1: Welcome + Community Code ─── */}
        {step === 1 && (
          <Card>
            <CardContent className="p-8">
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
                  <span className="text-primary-foreground font-bold text-lg">H</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome, {adminName}!</h1>
                <p className="text-muted-foreground mt-1">Let&apos;s get <strong>{hoaName}</strong> set up in a few quick steps.</p>
              </div>

              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 mb-6">
                <p className="text-sm font-semibold text-blue-900 mb-1">Your community code</p>
                <p className="text-xs text-blue-700 mb-3">Share this with your residents so they can create their accounts at <strong>/signup</strong></p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-white border border-blue-200 px-4 py-2.5 text-base font-mono font-semibold text-slate-900">
                    {subdomain}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyText(subdomain)} className="shrink-0 border-blue-200">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button className="w-full" onClick={() => setStep(2)}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2: CC&R Documents ─── */}
        {step === 2 && (
          <Card>
            <CardContent className="p-8">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Upload CC&R Documents</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Upload your community&apos;s governing documents to enable AI-powered rule search for residents and administrators.
              </p>

              <a
                href="/admin/documents"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 transition-colors p-5 mb-6 group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                  <FileText className="h-5 w-5 text-slate-500 group-hover:text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Go to CC&R Documents</p>
                  <p className="text-xs text-muted-foreground">Opens in a new tab — upload PDFs there</p>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
              </a>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Skip for now</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Done, continue →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 3: Amenities ─── */}
        {step === 3 && (
          <Card>
            <CardContent className="p-8">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                <CalendarDays className="h-5 w-5 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Add Community Amenities</h2>
              <p className="text-muted-foreground text-sm mb-5">
                Add spaces residents can book — pool, clubhouse, gym, etc.
              </p>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-2 mb-4">
                {['Piscina', 'Salão de Festas', 'Academia', 'Espaço Gourmet', 'Quadra'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmenityForm((f) => ({ ...f, name: preset }))}
                    className="px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Amenity name"
                  value={amenityForm.name}
                  onChange={(e) => setAmenityForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Capacity"
                  value={amenityForm.capacity}
                  onChange={(e) => setAmenityForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-28"
                  min="1"
                />
                <Button type="button" onClick={addAmenity} disabled={addingAmenity || !amenityForm.name.trim()} size="sm">
                  Add
                </Button>
              </div>

              {amenities.length > 0 && (
                <ul className="space-y-1.5 mb-4 mt-3">
                  {amenities.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{a.name}</span>
                        {a.capacity && <span className="text-xs text-muted-foreground ml-2">· {a.capacity} people</span>}
                      </div>
                      <button onClick={() => removeAmenity(a.id)} className="text-slate-400 hover:text-destructive text-xs ml-4">Remove</button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>Skip for now</Button>
                <Button className="flex-1" onClick={() => setStep(4)}>Continue →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 4: Invite Residents ─── */}
        {step === 4 && (
          <Card>
            <CardContent className="p-8">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Invite Your Residents</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Choose how residents will access {hoaName}.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <a
                  href="/admin/residents/import"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors p-4 group"
                >
                  <div className="w-8 h-8 rounded-md bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Users className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Import via CSV</p>
                  <p className="text-xs text-muted-foreground">Upload a spreadsheet of residents — they receive an invitation email with a link to create their password.</p>
                  <span className="text-xs text-primary font-medium flex items-center gap-1 mt-auto">
                    Open importer <ExternalLink className="h-3 w-3" />
                  </span>
                </a>

                <div className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 p-4">
                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center">
                    <Copy className="h-4 w-4 text-slate-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Share the sign-up link</p>
                  <p className="text-xs text-muted-foreground">Residents visit <strong>/signup</strong> and enter the community code to create their own account.</p>
                  <div className="flex items-center gap-1.5 mt-auto">
                    <code className="text-xs bg-slate-100 rounded px-2 py-1 flex-1 truncate">{signupUrl}</code>
                    <button
                      onClick={() => copyText(signupUrl)}
                      className="text-slate-400 hover:text-primary transition-colors"
                      title="Copy link"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={finish} disabled={finishing}>
                {finishing ? 'Setting up…' : 'Go to Dashboard →'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
