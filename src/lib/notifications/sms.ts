import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

const FROM = process.env.TWILIO_PHONE_NUMBER ?? ''

export async function sendSms(to: string, body: string): Promise<void> {
  if (!FROM) return
  try {
    await client.messages.create({ from: FROM, to, body })
  } catch (err) {
    console.error('SMS send failed:', err)
  }
}
