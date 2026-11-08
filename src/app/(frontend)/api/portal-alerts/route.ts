import { z } from 'zod'
import { portalIdentity, assertSameOrigin } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { defaultAlertPreferences } from '@/lib/portal-notifications'

const headers = { 'Cache-Control': 'private, no-store' }
const settings = z
  .object({
    leadAlerts: z.boolean(),
    soundEnabled: z.boolean(),
    callReminders: z.boolean(),
    advanceMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
    followUpReminders: z.boolean(),
    desktopEnabled: z.boolean(),
  })
  .strict()
export async function GET(request: Request) {
  try {
    const user = await portalIdentity()
    if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
    const payload = await getPayloadClient()
    const url = new URL(request.url)
    const query = z
      .object({
        since: z.string().datetime({ offset: true }).optional(),
        until: z.string().datetime({ offset: true }).optional(),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(Object.fromEntries(url.searchParams))
    const now = new Date()
    const until =
      query.until && Date.parse(query.until) <= now.getTime() ? query.until : now.toISOString()
    const options = { user, overrideAccess: false as const, depth: 0 }
    const [personal, workspace, incoming, calls, followUps] = await Promise.all([
      payload.find({ ...options, collection: 'notification-preferences', limit: 1 }),
      payload.find({ ...options, collection: 'workspace-settings', limit: 1 }),
      query.since
        ? payload.find({
            ...options,
            collection: 'leads',
            limit: 100,
            page: query.page,
            sort: ['createdAt', 'id'],
            where: {
              and: [
                { createdAt: { greater_than_equal: query.since, less_than_equal: until } },
                { archived: { not_equals: true } },
              ],
            },
            select: { sourceId: true, name: true, source: true, createdAt: true },
          })
        : Promise.resolve({ docs: [], hasNextPage: false }),
      payload.find({
        ...options,
        collection: 'appointments',
        pagination: false,
        sort: 'start',
        where: {
          and: [
            { status: { equals: 'Scheduled' } },
            {
              start: {
                greater_than_equal: new Date(now.getTime() - 120000).toISOString(),
                less_than_equal: new Date(now.getTime() + 86400000).toISOString(),
              },
            },
          ],
        },
        select: { sourceId: true, title: true, start: true, owner: true, status: true },
      }),
      payload.find({
        ...options,
        collection: 'leads',
        pagination: false,
        sort: 'followUp',
        where: {
          and: [
            { archived: { not_equals: true } },
            { taskCompleted: { not_equals: true } },
            { sales: { not_in: ['Closed', 'Won', 'Lost', 'Disqualified'] } },
            {
              followUp: {
                greater_than_equal: new Date(now.getTime() - 7 * 86400000).toISOString(),
                less_than_equal: new Date(now.getTime() + 86400000).toISOString(),
              },
            },
          ],
        },
        select: { sourceId: true, name: true, followUp: true, nextAction: true },
      }),
    ])
    const profile = personal.docs[0]
    const preferences = profile
      ? {
          leadAlerts: profile.leadAlerts ?? true,
          soundEnabled: profile.soundEnabled ?? true,
          callReminders: profile.callReminders ?? true,
          advanceMinutes: Number(profile.advanceMinutes),
          followUpReminders: profile.followUpReminders ?? true,
          desktopEnabled: profile.desktopEnabled ?? false,
        }
      : defaultAlertPreferences
    return Response.json(
      {
        preferences,
        workspaceEnabled: workspace.docs[0]?.notifications !== false,
        serverTime: new Date().toISOString(),
        until,
        nextPage: incoming.hasNextPage ? query.page + 1 : null,
        newLeads: incoming.docs.map((lead) => ({
          id: lead.sourceId,
          documentId: lead.id,
          name: lead.name,
          source: lead.source,
          createdAt: lead.createdAt,
        })),
        calls: calls.docs.map((call) => ({
          id: call.sourceId,
          documentId: call.id,
          title: call.title,
          start: call.start,
          owner: call.owner,
          status: call.status,
        })),
        followUps: followUps.docs
          .filter((row) => row.followUp)
          .map((row) => ({
            id: row.sourceId,
            documentId: row.id,
            name: row.name,
            followUp: row.followUp,
            nextAction: row.nextAction || '',
          })),
      },
      { headers },
    )
  } catch {
    return Response.json(
      { error: 'Alert updates are temporarily unavailable.' },
      { status: 400, headers },
    )
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await portalIdentity()
    if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
    const data = settings.parse(await request.json())
    const payload = await getPayloadClient()
    const options = { user, overrideAccess: false as const, context: { alertSettingsWrite: true } }
    const found = await payload.find({
      ...options,
      collection: 'notification-preferences',
      limit: 1,
    })
    const values = {
      ...data,
      advanceMinutes: String(data.advanceMinutes) as '5' | '10' | '15' | '30',
    }
    if (found.docs[0])
      await payload.update({
        ...options,
        collection: 'notification-preferences',
        id: found.docs[0].id,
        data: values,
      })
    else
      await payload.create({
        ...options,
        collection: 'notification-preferences',
        data: {
          ...values,
          recipientKey: `${user.collection}:${user.id}`,
          recipient: { relationTo: user.collection, value: user.id },
        },
      })
    return Response.json({ ok: true, preferences: data }, { headers })
  } catch {
    return Response.json(
      { error: 'Alert settings could not be saved. Please retry.' },
      { status: 400, headers },
    )
  }
}
