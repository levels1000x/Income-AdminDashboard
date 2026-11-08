import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { portalIdentity, assertSameOrigin } from '@/lib/app-auth'
import { isManager } from '@/lib/portal-access'
import { getPayloadClient } from '@/lib/payload'
import { emailConfigured, sendPortalEmail } from '@/lib/portal-email'
import {
  envelope,
  leadFields,
  leadUpdate,
  appointmentFields,
  webinarFields,
  calendarFile,
} from '@/lib/portal-validation'

export async function GET() {
  const user = await portalIdentity()
  if (!user)
    return Response.json(
      { error: 'Sign in to access Income administration.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    )
  const payload = await getPayloadClient()
  const options = { user, overrideAccess: false as const, depth: 0, pagination: false as const }
  const [leads, appointments, payments, webinars, team, settings, activities, users, messages] =
    await Promise.all([
      payload.find({ ...options, collection: 'leads', sort: '-received' }),
      payload.find({ ...options, collection: 'appointments', sort: 'start' }),
      payload.find({ ...options, collection: 'payments' }),
      payload.find({ ...options, collection: 'webinars', sort: '-startsAt' }),
      payload.find({ ...options, collection: 'team-members' }),
      payload.find({ ...options, collection: 'workspace-settings', limit: 1 }),
      payload.find({
        ...options,
        collection: 'activity',
        pagination: true,
        limit: 100,
        sort: '-createdAt',
      }),
      isManager(user)
        ? payload.find({ ...options, collection: 'users' })
        : Promise.resolve({ docs: [] }),
      isManager(user)
        ? payload.find({
            ...options,
            collection: 'communications',
            pagination: true,
            limit: 100,
            sort: '-createdAt',
          })
        : Promise.resolve({ docs: [] }),
    ])
  const names = new Map(leads.docs.map((lead) => [String(lead.id), lead.sourceId]))
  const sessions = new Map(webinars.docs.map((session) => [String(session.id), session]))
  return Response.json(
    {
      user: {
        id: user.id,
        name: 'name' in user ? user.name : 'Administrator',
        email: user.email,
        canManage: isManager(user),
        cms: user.collection === 'admins',
      },
      leads: leads.docs.map((lead) => ({
        ...lead,
        id: lead.sourceId,
        documentId: lead.id,
        session: sessions.get(String(lead.webinar))?.title || lead.session,
        operationalStatus:
          lead.source === 'Webinar'
            ? lead.followUpStatus !== 'Not started'
              ? lead.followUpStatus
              : lead.registrationStatus
            : lead.operationalStatus,
        answers: (lead.answers ?? []).map((answer) => [answer.label, answer.value || '']),
        followUp: lead.followUp || '',
        received: lead.received,
        notes: lead.notes || '',
        owner: lead.owner || 'Unassigned',
        phone: lead.phone || '',
        company: lead.company || '',
        nextAction: lead.nextAction || '',
        qualification: lead.qualification || 'Not reviewed',
        service: lead.service || '',
      })),
      appointments: appointments.docs.map((call) => ({
        ...call,
        documentId: call.id,
        id: call.sourceId,
        leadId: names.get(String(call.lead)) || '',
        outcome: call.outcome || '',
      })),
      payments: await Promise.all(
        payments.docs.map(async (payment) => {
          let proofURL: string | undefined
          if (payment.proofFile) {
            const proof = await payload.findByID({
              collection: 'payment-proofs',
              id: typeof payment.proofFile === 'object' ? payment.proofFile.id : payment.proofFile,
              overrideAccess: false,
              user,
            })
            proofURL = proof.url || undefined
          }
          return { ...payment, documentId: payment.id, id: payment.sourceId, proofURL }
        }),
      ),
      webinars: webinars.docs,
      team: team.docs,
      preferences: settings.docs[0] ?? {
        workspace: 'Income',
        timezone: 'America/New_York',
        notifications: true,
      },
      activities: activities.docs,
      users: users.docs.map(({ id, name, email, role, status, updatedAt }) => ({
        id,
        name,
        email,
        role,
        status,
        updatedAt,
      })),
      messages: messages.docs,
      emailConfigured: emailConfigured(),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await portalIdentity()
    if (!user) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
    const payload = await getPayloadClient()
    const input = envelope.parse(await request.json())
    const options = { user, overrideAccess: false as const, depth: 0 }
    const manager = () => {
      if (!isManager(user)) throw new Error('Administrator or manager permission required.')
    }
    const id = () => z.string().min(1).parse(input.id)
    const checkVersion = async (
      collection: 'leads' | 'appointments' | 'payments' | 'webinars' | 'users',
    ) => {
      const existing = await payload.findByID({ ...options, collection, id: id() })
      if (!input.updatedAt || existing.updatedAt !== input.updatedAt)
        throw new Error('This record changed since you opened it. Refresh before saving.')
      return existing
    }
    let message = 'Changes saved.'
    switch (input.action) {
      case 'createLead': {
        const data = leadFields.parse(input.data)
        await payload.create({
          ...options,
          collection: 'leads',
          data: {
            ...data,
            registrationStatus: data.registrationStatus || 'Registered',
            attendance: data.attendance || 'Not recorded',
            followUpStatus: data.followUpStatus || 'Not started',
            followUp: data.followUp || null,
            sourceId: `${data.source === 'Webinar' ? 'webinar' : 'manual'}:${randomUUID()}`,
            received: new Date().toISOString(),
            answers: [],
          },
        })
        break
      }
      case 'saveLead': {
        await checkVersion('leads')
        const data = leadUpdate.parse(input.data)
        await payload.update({
          ...options,
          collection: 'leads',
          id: id(),
          data: {
            ...data,
            ...(data.followUp !== undefined ? { followUp: data.followUp || null } : {}),
          },
        })
        break
      }
      case 'archiveLead': {
        manager()
        await checkVersion('leads')
        const data = z
          .object({ archived: z.boolean(), archiveReason: z.string().trim().min(1).max(500) })
          .strict()
          .parse(input.data)
        await payload.update({ ...options, collection: 'leads', id: id(), data })
        message = data.archived ? 'Lead archived. Linked records were retained.' : 'Lead restored.'
        break
      }
      case 'createAppointment': {
        const data = appointmentFields.parse(input.data)
        await payload.create({
          ...options,
          collection: 'appointments',
          data: { ...data, sourceId: `appointment:${randomUUID()}` },
        })
        break
      }
      case 'saveAppointment': {
        await checkVersion('appointments')
        const data = appointmentFields.parse(input.data)
        await payload.update({ ...options, collection: 'appointments', id: id(), data })
        break
      }
      case 'createWebinar':
      case 'saveWebinar': {
        manager()
        const data = webinarFields.parse(input.data)
        if (input.action === 'saveWebinar') {
          await checkVersion('webinars')
          await payload.update({ ...options, collection: 'webinars', id: id(), data })
        } else await payload.create({ ...options, collection: 'webinars', data })
        break
      }
      case 'savePayment': {
        manager()
        await checkVersion('payments')
        const data = z
          .object({
            status: z.enum([
              'Wire pending',
              'Wire received',
              'Needs review',
              'Proof submitted',
              'Confirmed',
              'Rejected',
            ]),
            reviewNotes: z.string().max(5000),
          })
          .strict()
          .parse(input.data)
        if (data.status === 'Rejected' && !data.reviewNotes.trim())
          throw new Error('Enter a rejection reason.')
        await payload.update({ ...options, collection: 'payments', id: id(), data })
        break
      }
      case 'savePreferences': {
        manager()
        const data = z
          .object({
            workspace: z.string().trim().min(1).max(100),
            timezone: z.string().refine((v) => {
              try {
                new Intl.DateTimeFormat('en', { timeZone: v })
                return true
              } catch {
                return false
              }
            }),
            notifications: z.boolean(),
          })
          .strict()
          .parse(input.data)
        const result = await payload.find({
          ...options,
          collection: 'workspace-settings',
          limit: 1,
        })
        if (result.docs[0])
          await payload.update({
            ...options,
            collection: 'workspace-settings',
            id: result.docs[0].id,
            data,
          })
        else await payload.create({ ...options, collection: 'workspace-settings', data })
        break
      }
      case 'saveHours': {
        manager()
        const data = z
          .object({
            availableFrom: z.string().regex(/^\d{2}:\d{2}$/),
            availableUntil: z.string().regex(/^\d{2}:\d{2}$/),
          })
          .strict()
          .parse(input.data)
        if (data.availableFrom >= data.availableUntil)
          throw new Error('Working hours must end after they begin.')
        await payload.update({ ...options, collection: 'team-members', id: id(), data })
        break
      }
      case 'createTeamMember': {
        manager()
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            role: z.string().trim().min(1).max(100),
            availableFrom: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
            availableUntil: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          })
          .strict()
          .parse(input.data)
        if (data.availableFrom >= data.availableUntil)
          throw new Error('Working hours must end after they begin.')
        const existing = await payload.find({
          ...options,
          collection: 'team-members',
          where: { name: { equals: data.name } },
          limit: 1,
        })
        if (existing.totalDocs) throw new Error('A scheduling host with that name already exists.')
        await payload.create({
          ...options,
          collection: 'team-members',
          data: { ...data, active: true },
        })
        break
      }
      case 'inviteUser': {
        manager()
        if (!emailConfigured())
          throw new Error(
            'Connect Resend before inviting staff. No invitation was created or sent.',
          )
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            email: z.string().email(),
            role: z.enum(['administrator', 'manager', 'sales']),
          })
          .strict()
          .parse(input.data)
        const member = await payload.create({
          ...options,
          collection: 'users',
          data: { ...data, password: randomUUID() + randomUUID(), status: 'invited' },
        })
        await payload.forgotPassword({
          collection: 'users',
          data: { email: member.email },
          disableEmail: false,
        })
        await payload.update({
          ...options,
          collection: 'users',
          id: member.id,
          data: { invitationSentAt: new Date().toISOString() },
        })
        message = 'Invitation accepted by the email provider. The setup link expires in 24 hours.'
        break
      }
      case 'resendInvite': {
        manager()
        if (!emailConfigured()) throw new Error('Email is not configured.')
        const member = await payload.findByID({ ...options, collection: 'users', id: id() })
        if (member.status !== 'invited') throw new Error('Only pending invitations may be resent.')
        await payload.forgotPassword({
          collection: 'users',
          data: { email: member.email },
          disableEmail: false,
        })
        message = 'New invitation requested. The previous setup link is invalidated.'
        break
      }
      case 'updateUser': {
        manager()
        await checkVersion('users')
        if (String(user.id) === id() && user.collection === 'users')
          throw new Error('You cannot change your own role or disable your account.')
        const data = z
          .object({
            role: z.enum(['administrator', 'manager', 'sales']),
            status: z.enum(['active', 'disabled', 'invited']),
          })
          .strict()
          .parse(input.data)
        await payload.update({ ...options, collection: 'users', id: id(), data })
        break
      }
      case 'sendAppointment': {
        manager()
        const call = await payload.findByID({ ...options, collection: 'appointments', id: id() })
        const lead = await payload.findByID({
          ...options,
          collection: 'leads',
          id: typeof call.lead === 'object' ? call.lead.id : call.lead,
        })
        const result = await sendPortalEmail({
          to: lead.email,
          subject: `${call.status === 'Cancelled' ? 'Cancelled' : 'Appointment'}: ${call.title}`,
          text: `${call.title}\n${new Date(call.start).toUTCString()}\n${call.meetingURL || ''}\n${call.cancellationReason || ''}`,
          recordId: String(call.id),
          kind: 'appointment',
          ics: calendarFile({ ...call, id: String(call.id) }, lead.email),
        })
        if (!result.sent) throw new Error(result.message)
        message = result.message
        break
      }
      case 'sendWebinar': {
        manager()
        const data = z
          .object({
            recipients: z.array(z.string()).min(1).max(100),
            kind: z.enum(['Invitation', 'Reminder', 'Follow-up', 'Cancellation']),
          })
          .strict()
          .parse(input.data)
        const webinar = await payload.findByID({ ...options, collection: 'webinars', id: id() })
        if (!emailConfigured()) throw new Error('Email is not configured. No message was sent.')
        const recipients = await payload.find({
          ...options,
          collection: 'leads',
          pagination: false,
          where: {
            and: [
              { id: { in: data.recipients } },
              { webinar: { equals: webinar.id } },
              { archived: { not_equals: true } },
              { registrationStatus: { not_equals: 'Cancelled' } },
            ],
          },
        })
        if (recipients.docs.length !== new Set(data.recipients).size)
          throw new Error('Select only active registrants from this webinar.')
        let sent = 0
        for (const lead of recipients.docs) {
          const result = await sendPortalEmail({
            to: lead.email,
            subject: `${data.kind}: ${webinar.title}`,
            text: `${webinar.title}\n${new Date(webinar.startsAt).toUTCString()}\n${data.kind === 'Follow-up' && webinar.replayPublished ? webinar.replayURL || '' : webinar.joinURL || ''}\n${data.kind === 'Cancellation' ? webinar.cancellationReason || '' : webinar.description || ''}`,
            recordId: String(webinar.id),
            kind: 'webinar',
          })
          if (result.sent) sent++
        }
        message = `${sent} of ${recipients.docs.length} messages accepted by the provider. Review delivery activity for failures.`
        break
      }
      default:
        throw new Error('Unsupported action.')
    }
    return Response.json({ ok: true, message })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
        : error instanceof Error
          ? error.message
          : 'Unable to save. Please retry.'
    return Response.json({ ok: false, error: message }, { status: 400 })
  }
}
