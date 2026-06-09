import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/notifications/email'

export async function POST(request: Request) {
  const body = await request.json()
  const { name, email, phone, type } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
  }

  const typeLabel = type === 'resident' ? 'Current Resident' : 'Interested Buyer'
  const to = process.env.HOA_CONTACT_EMAIL ?? process.env.RESEND_FROM_ADDRESS ?? 'info@yourhoa.app'

  const html = `
    <h2>New Contact Form Submission — Tara Cay Sound</h2>
    <table style="border-collapse:collapse;width:100%;max-width:500px">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Name</td><td style="padding:8px 0;font-size:14px">${name}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${email}">${email}</a></td></tr>
      ${phone ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Phone</td><td style="padding:8px 0;font-size:14px">${phone}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Type</td><td style="padding:8px 0;font-size:14px">${typeLabel}</td></tr>
    </table>
  `

  await sendEmail(to, `New inquiry from ${name} — ${typeLabel}`, html)

  return NextResponse.json({ ok: true })
}
