import { DM_Serif_Display } from 'next/font/google'

const dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dmSerifDisplay.variable} min-h-screen scroll-smooth`}>
      {children}
    </div>
  )
}
