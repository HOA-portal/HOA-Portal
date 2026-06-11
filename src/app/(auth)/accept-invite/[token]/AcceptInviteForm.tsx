'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InviteData {
  id: string
  email: string
  full_name: string | null
  unit_number: string | null
  phone: string | null
  hoa_name: string
  hoa_subdomain: string
}

interface AcceptInviteFormProps {
  token: string
  invite: InviteData
}

export function AcceptInviteForm({ token, invite }: AcceptInviteFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const body = await res.json()

    if (!res.ok) {
      setError(body.error ?? 'Failed to activate account. Please try again.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    })

    if (signInError) {
      setError('Account activated! Please sign in.')
      router.push('/login')
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={invite.email} disabled className="bg-slate-50" />
      </div>

      {invite.full_name && (
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={invite.full_name} disabled className="bg-slate-50" />
        </div>
      )}

      {invite.unit_number && (
        <div className="space-y-2">
          <Label>Unit</Label>
          <Input value={invite.unit_number} disabled className="bg-slate-50" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="Repeat password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Activating…' : 'Activate account'}
      </Button>
    </form>
  )
}
