import 'server-only'
import { getPayloadClient } from './payload'
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
export async function sendPortalEmail(input: { to: string; subject: string; text: string; recordId: string; kind: string; ics?: string }) {
  const payload = await getPayloadClient()
  const log = await payload.create({ collection: 'communications', overrideAccess: true, data: { recipient: input.to, subject: input.subject, recordId: input.recordId, kind: input.kind, status: emailConfigured() ? 'pending' : 'not-configured' } })
  if (!emailConfigured()) return { sent: false, message: 'Email is not configured. No message was sent.' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': String(log.id) },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, text: input.text,
        ...(input.ics ? { attachments: [{ filename: 'appointment.ics', content: Buffer.from(input.ics).toString('base64'), content_type: 'text/calendar' }] } : {}),
      }),
    })
    const body = await response.json()
    if (!response.ok || !body.id) throw new Error('Email provider rejected the request.')
    await payload.update({ collection: 'communications', id: log.id, overrideAccess: true, data: { status: 'sent', providerId: body.id } })
    return { sent: true, message: 'Email accepted by the provider. Delivery is not yet confirmed.' }
  } catch {
    await payload.update({ collection: 'communications', id: log.id, overrideAccess: true, data: { status: 'failed', error: 'Provider request failed. Review provider configuration before retrying.' } })
    return { sent: false, message: 'Email failed. The saved record is unchanged; review delivery activity before retrying.' }
  }
}
