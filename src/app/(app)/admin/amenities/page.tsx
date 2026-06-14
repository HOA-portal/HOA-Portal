'use client'

import { useEffect, useState } from 'react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Users } from 'lucide-react'

interface Amenity {
  id: string
  name: string
  description: string | null
  capacity: number | null
  rules: string | null
  is_active: boolean
}

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', capacity: '', rules: '' })
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/amenities')
    if (res.ok) setAmenities(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch('/api/admin/amenities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        rules: form.rules || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setAmenities((prev) => [...prev, created])
      setOpen(false)
      setForm({ name: '', description: '', capacity: '', rules: '' })
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to create amenity.')
    }
    setSaving(false)
  }

  async function toggleActive(amenity: Amenity) {
    const res = await fetch(`/api/admin/amenities/${amenity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !amenity.is_active }),
    })
    if (res.ok) {
      setAmenities((prev) => prev.map((a) => a.id === amenity.id ? { ...a, is_active: !a.is_active } : a))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this amenity? Existing bookings will be cancelled.')) return
    const res = await fetch(`/api/admin/amenities/${id}`, { method: 'DELETE' })
    if (res.ok) setAmenities((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6">
        <AdminPageHeader
          title="Amenities"
          description="Manage community spaces available for resident booking."
          action={
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Amenity
            </Button>
          }
        />

        {loading ? (
          <p className="text-sm text-muted-foreground mt-4">Loading…</p>
        ) : amenities.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No amenities yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Add a pool, clubhouse, or other space so residents can make bookings.</p>
              <Button className="mt-4" size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add first amenity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <Card key={a.id} className={a.is_active ? '' : 'opacity-60'}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm">{a.name}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${a.is_active ? 'bg-primary' : 'bg-slate-300'}`}
                        aria-label={a.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${a.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-slate-400 hover:text-destructive transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mb-2">{a.description}</p>}
                  {a.capacity && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Capacity: {a.capacity}</span>
                    </div>
                  )}
                  {a.rules && <p className="text-xs text-muted-foreground mt-1 italic">{a.rules}</p>}
                  <p className="text-xs mt-2 font-medium" style={{ color: a.is_active ? 'var(--color-green-600, #16a34a)' : 'var(--color-slate-400, #94a3b8)' }}>
                    {a.is_active ? 'Active — bookable by residents' : 'Inactive — hidden from residents'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Amenity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="e.g. Community Pool" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Piscina', 'Salão', 'Academia', 'Espaço Gourmet'].map((preset) => (
                <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, name: preset }))}>
                  {preset}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="Brief description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">Capacity (max people)</Label>
              <Input id="capacity" type="number" min="1" placeholder="50" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rules">Rules / Notes</Label>
              <Textarea id="rules" placeholder="e.g. Must be vacated by 10pm." value={form.rules} onChange={(e) => setForm((f) => ({ ...f, rules: e.target.value }))} rows={2} />
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Amenity'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
