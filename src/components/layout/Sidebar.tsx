'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import {
  MessageSquare,
  Wrench,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Megaphone,
} from 'lucide-react'

const residentNav = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/work-orders', label: 'Work Orders', icon: Wrench },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/complaints', label: 'Complaints', icon: ClipboardList },
]

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'AI Assistant', icon: MessageSquare },
  { href: '/admin/work-orders', label: 'Work Orders', icon: Wrench },
  { href: '/admin/violations', label: 'Violations', icon: ShieldAlert },
  { href: '/admin/complaints', label: 'Complaints', icon: ClipboardList },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
]

interface SidebarProps {
  profile: Profile
  hoaName: string
}

export default function Sidebar({ profile, hoaName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = profile.role === 'admin' ? adminNav : residentNav

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-slate-200 bg-white">
      {/* Logo / HOA name */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">H</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{hoaName}</p>
          <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.href === '/admin'
            ? pathname === '/admin'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-slate-600">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">
              {profile.full_name ?? 'Resident'}
            </p>
            {profile.unit_number && (
              <p className="text-xs text-muted-foreground">{profile.unit_number}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
