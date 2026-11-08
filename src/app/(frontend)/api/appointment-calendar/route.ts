import { portalIdentity } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { calendarFile } from '@/lib/portal-validation'

export async function GET(request: Request) {
  const user = await portalIdentity()
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'Select an appointment.' }, { status: 400, headers })
  try {
    const payload = await getPayloadClient()
    const options = { user, overrideAccess: false as const, depth: 0 }
    const [call, settings] = await Promise.all([
      payload.findByID({ ...options, collection: 'appointments', id }),
      payload.find({ ...options, collection: 'notification-preferences', limit: 1 }),
    ])
    const preference = settings.docs[0]
    const minutes =
      preference?.callReminders === false ? 0 : Number(preference?.advanceMinutes || '10')
    return new Response(
      calendarFile({ ...call, id: String(call.id) }, user.email || '', true, minutes),
      {
        headers: {
          ...headers,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="income-appointment.ics"',
        },
      },
    )
  } catch {
    return Response.json({ error: 'This appointment is unavailable.' }, { status: 404, headers })
  }
}
