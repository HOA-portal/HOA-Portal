import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_ADDRESS ?? 'noreply@yourhoa.app'

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('Email send failed:', err)
  }
}
