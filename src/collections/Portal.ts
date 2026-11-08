import {
  APIError,
  type CollectionConfig,
  type CollectionBeforeChangeHook,
  type CollectionAfterChangeHook,
  type TextField,
  type SelectField,
} from 'payload'
import {
  staffAccess,
  managerAccess,
  managerField,
  immutableField,
  isManager,
} from '../lib/portal-access'

const text = (name: string, required = false): TextField => ({
  name,
  type: 'text',
  required,
  maxLength: 500,
})
const choice = (name: string, options: string[], defaultValue?: string): SelectField => ({
  name,
  type: 'select',
  options,
  defaultValue,
  required: true,
})
const managed = { create: managerField, update: managerField }
const noAccess = () => false
const audit: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  collection,
  previousDoc,
}) => {
  if (req.context.skipPortalAudit) return doc
  await req.payload.create({
    collection: 'activity',
    overrideAccess: true,
    req,
    data: {
      title: `${operation === 'create' ? 'Created' : 'Updated'} ${collection.slug}`,
      recordId: String(doc.id),
      recordType: collection.slug,
      actor: req.user?.email || 'System import',
      detail: Object.keys(doc)
        .filter(
          (key) =>
            !['updatedAt', 'createdAt', 'id'].includes(key) &&
            JSON.stringify(doc[key]) !== JSON.stringify(previousDoc?.[key]),
        )
        .join(', '),
    },
  })
  return doc
}
const base = (slug: string, title: string): CollectionConfig => ({
  slug,
  admin: { useAsTitle: title, group: 'Income operations' },
  access: { read: staffAccess, create: staffAccess, update: staffAccess, delete: noAccess },
  versions: { maxPerDoc: 20 },
  hooks: { afterChange: [audit] },
  fields: [],
})

export const Users: CollectionConfig = {
  ...base('users', 'name'),
  auth: {
    tokenExpiration: 60 * 60 * 8,
    forgotPassword: {
      expiration: 60 * 60 * 24,
      generateEmailSubject: () => 'Your Income workspace invitation',
      generateEmailHTML: ({ token } = {}) => {
        const url = `${process.env.NEXT_PUBLIC_SITE_URL}/set-password?token=${encodeURIComponent(token || '')}`
        return `<p>You have been invited to Income administration.</p><p><a href="${url}">Set your password</a>. This secure invitation expires in 24 hours.</p>`
      },
    },
  },
  access: {
    admin: noAccess,
    create: managerAccess,
    read: ({ req }) =>
      isManager(req.user) ||
      (req.user?.collection === 'users' ? { id: { equals: req.user.id } } : false),
    update: ({ req, id }) =>
      isManager(req.user) ||
      (req.user?.collection === 'users' &&
        String(req.user.id) === String(id) &&
        req.context.acceptPortalInvitation === String(id)),
    delete: noAccess,
  },
  fields: [
    text('name', true),
    { ...choice('role', ['administrator', 'manager', 'sales'], 'sales'), access: managed },
    {
      ...choice('status', ['invited', 'active', 'disabled'], 'invited'),
      access: {
        create: managerField,
        update: ({ req, data }) =>
          isManager(req.user) ||
          (req.user?.collection === 'users' &&
            req.context.acceptPortalInvitation === String(req.user.id) &&
            data?.status === 'active'),
      },
    },
    { name: 'invitationSentAt', type: 'date', access: managed },
    { name: 'availableFrom', type: 'text', defaultValue: '09:00' },
    { name: 'availableUntil', type: 'text', defaultValue: '17:00' },
  ],
}

export const Leads: CollectionConfig = {
  ...base('leads', 'name'),
  fields: [
    { ...text('sourceId', true), unique: true, index: true, access: { update: immutableField } },
    text('name', true),
    { name: 'email', type: 'email', required: true },
    text('phone'),
    text('company'),
    {
      ...choice('source', [
        'Apply',
        'Invest',
        'Capital acquisition',
        'Credit partners',
        'Webinar',
        'Manual',
      ]),
      access: { update: immutableField },
    },
    text('service'),
    text('qualification'),
    choice(
      'sales',
      [
        'Not started',
        'Conversation started',
        'Call booked',
        'Won',
        'Lost',
        'Disqualified',
        'Closed',
      ],
      'Not started',
    ),
    text('owner'),
    text('nextAction'),
    { name: 'followUp', type: 'date' },
    { name: 'received', type: 'date', required: true },
    { name: 'notes', type: 'textarea', maxLength: 5000 },
    { name: 'archived', type: 'checkbox', defaultValue: false, access: managed },
    { name: 'archiveReason', type: 'text', access: managed },
    { name: 'webinar', type: 'relationship', relationTo: 'webinars' },
    text('session'),
    text('engagement'),
    choice(
      'registrationStatus',
      ['Registered', 'Confirmed', 'Waitlisted', 'Cancelled'],
      'Registered',
    ),
    choice('attendance', ['Not recorded', 'Registered', 'Attended', 'No Show'], 'Not recorded'),
    choice(
      'followUpStatus',
      ['Not started', 'Follow-Up Needed', 'Contacted', 'Applied'],
      'Not started',
    ),
    text('operationalStatus'),
    { name: 'answers', type: 'array', fields: [text('label', true), text('value')] },
    { name: 'linkedApplication', type: 'relationship', relationTo: 'leads' },
    { name: 'taskCompleted', type: 'checkbox', defaultValue: false },
  ],
  hooks: {
    afterChange: [audit],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const value = { ...originalDoc, ...data }
        if (value.archived && !value.archiveReason?.trim())
          throw new APIError('An archive reason is required.', 400)
        if (value.linkedApplication) {
          const linked = await req.payload.findByID({
            collection: 'leads',
            id: value.linkedApplication,
            overrideAccess: true,
            req,
            depth: 0,
          })
          if (
            value.source !== 'Webinar' ||
            linked.source === 'Webinar' ||
            linked.archived ||
            String(linked.id) === String(originalDoc?.id)
          )
            throw new APIError(
              'Link a webinar registration to a different, active application.',
              400,
            )
        }
        if (value.webinar) {
          const session = await req.payload.findByID({
            collection: 'webinars',
            id: value.webinar,
            overrideAccess: true,
            req,
            depth: 0,
          })
          if (value.source !== 'Webinar')
            throw new APIError('Only webinar registrations may belong to a webinar.', 400)
          if (
            !originalDoc &&
            (session.status === 'Cancelled' || session.registrationOpen === false)
          )
            throw new APIError('Registration is closed for this session.', 400)
          if (
            value.registrationStatus === 'Waitlisted' &&
            (!originalDoc || originalDoc.registrationStatus !== 'Waitlisted') &&
            !session.waitlistEnabled
          )
            throw new APIError('The waitlist is not enabled for this session.', 400)
          const takesNewSeat =
            !originalDoc ||
            originalDoc.webinar !== value.webinar ||
            ['Waitlisted', 'Cancelled'].includes(originalDoc.registrationStatus)
          if (takesNewSeat && !['Waitlisted', 'Cancelled'].includes(value.registrationStatus)) {
            const count = await req.payload.count({
              collection: 'leads',
              overrideAccess: true,
              req,
              where: {
                and: [
                  { webinar: { equals: session.id } },
                  { archived: { not_equals: true } },
                  { registrationStatus: { not_in: ['Cancelled', 'Waitlisted'] } },
                ],
              },
            })
            if (count.totalDocs >= session.capacity)
              throw new APIError('Capacity reached. Add this registrant to the waitlist.', 400)
          }
        }
        return data
      },
    ],
  },
}

const appointmentRules: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const value = { ...originalDoc, ...data }
  if (value.status === 'Cancelled' && !value.cancellationReason?.trim())
    throw new APIError('Enter a cancellation reason.', 400)
  const lead = await req.payload.findByID({
    collection: 'leads',
    id: value.lead,
    req,
    overrideAccess: true,
    depth: 0,
  })
  const rescheduling =
    !originalDoc ||
    value.start !== originalDoc.start ||
    value.minutes !== originalDoc.minutes ||
    value.owner !== originalDoc.owner ||
    value.lead !== originalDoc.lead ||
    (value.status === 'Scheduled' && originalDoc.status !== 'Scheduled')
  if (lead.source === 'Webinar' || (lead.archived && rescheduling && value.status === 'Scheduled'))
    throw new APIError('Select an active application, not a webinar registration.', 400)
  if (value.status === 'Scheduled') {
    const start = new Date(value.start).getTime()
    if (!Number.isFinite(start) || !(value.minutes >= 15 && value.minutes <= 240))
      throw new APIError('Enter a valid start and duration (15–240 minutes).', 400)
    if (rescheduling) {
      const hosts = await req.payload.find({
        collection: 'team-members',
        overrideAccess: true,
        req,
        limit: 1,
        where: { and: [{ name: { equals: value.owner } }, { active: { not_equals: false } }] },
      })
      const host = hosts.docs[0]
      if (!host) throw new APIError('Select an active scheduling host.', 400)
      const format = (date: Date) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(date)
      const begin = format(new Date(start))
      const finish = format(new Date(start + value.minutes * 60000))
      const valueOf = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find((part) => part.type === type)?.value || ''
      const clock = (parts: Intl.DateTimeFormatPart[]) =>
        `${valueOf(parts, 'hour')}:${valueOf(parts, 'minute')}`
      if (
        ['Sat', 'Sun'].includes(valueOf(begin, 'weekday')) ||
        valueOf(begin, 'weekday') !== valueOf(finish, 'weekday') ||
        clock(begin) < (host.availableFrom || '09:00') ||
        clock(finish) > (host.availableUntil || '17:00')
      )
        throw new APIError(
          'The appointment must fit the host’s Monday–Friday working hours (Eastern time).',
          400,
        )
    }
    const nearby = await req.payload.find({
      collection: 'appointments',
      overrideAccess: true,
      req,
      pagination: false,
      where: {
        and: [
          { owner: { equals: value.owner } },
          { status: { equals: 'Scheduled' } },
          {
            start: {
              greater_than: new Date(start - 86400000).toISOString(),
              less_than: new Date(start + 86400000).toISOString(),
            },
          },
        ],
      },
    })
    if (
      nearby.docs.some(
        (call) =>
          String(call.id) !== String(originalDoc?.id) &&
          new Date(call.start).getTime() < start + value.minutes * 60000 &&
          new Date(call.start).getTime() + call.minutes * 60000 > start,
      )
    )
      throw new APIError('This host already has an overlapping appointment.', 409)
  }
  return data
}
export const Appointments: CollectionConfig = {
  ...base('appointments', 'title'),
  hooks: { beforeChange: [appointmentRules], afterChange: [audit] },
  fields: [
    { ...text('sourceId', true), unique: true, access: { update: immutableField } },
    { name: 'lead', type: 'relationship', relationTo: 'leads', required: true },
    text('title', true),
    { name: 'start', type: 'date', required: true },
    { name: 'minutes', type: 'number', required: true, min: 15, max: 240 },
    text('owner', true),
    choice('status', ['Scheduled', 'Completed', 'No-show', 'Cancelled'], 'Scheduled'),
    { name: 'outcome', type: 'textarea' },
    text('meetingURL'),
    text('cancellationReason'),
  ],
}
export const Webinars: CollectionConfig = {
  ...base('webinars', 'title'),
  access: { read: staffAccess, create: managerAccess, update: managerAccess, delete: noAccess },
  fields: [
    text('title', true),
    { name: 'startsAt', type: 'date', required: true },
    text('timezone', true),
    text('host', true),
    { name: 'duration', type: 'number', required: true, min: 15, max: 480, defaultValue: 60 },
    choice('status', ['Draft', 'Scheduled', 'Live', 'Completed', 'Cancelled'], 'Draft'),
    { name: 'capacity', type: 'number', min: 1, max: 10000, required: true, defaultValue: 250 },
    { name: 'registrationOpen', type: 'checkbox', defaultValue: false },
    { name: 'waitlistEnabled', type: 'checkbox', defaultValue: true },
    text('joinURL'),
    { ...text('hostURL'), access: { read: managerField } },
    text('replayURL'),
    { name: 'replayPublished', type: 'checkbox', defaultValue: false },
    { name: 'description', type: 'textarea', maxLength: 5000 },
    text('cancellationReason'),
  ],
  hooks: {
    afterChange: [audit],
    beforeChange: [
      ({ data, originalDoc }) => {
        const value = { ...originalDoc, ...data }
        if (value.status === 'Cancelled') {
          if (!value.cancellationReason?.trim())
            throw new APIError('A cancellation reason is required.', 400)
          data.registrationOpen = false
        }
        if (value.replayPublished && !value.replayURL)
          throw new APIError('Add a replay link before publishing.', 400)
        for (const key of ['joinURL', 'hostURL', 'replayURL']) {
          if (value[key] && !value[key].startsWith('https://'))
            throw new APIError('Room and replay links must use HTTPS.', 400)
        }
        return data
      },
    ],
  },
}
export const Payments: CollectionConfig = {
  ...base('payments', 'name'),
  access: { read: staffAccess, create: managerAccess, update: managerAccess, delete: noAccess },
  fields: [
    { ...text('sourceId', true), unique: true, access: { update: immutableField } },
    text('name', true),
    text('service'),
    { name: 'amount', type: 'number', min: 0, required: true },
    choice('status', [
      'Wire pending',
      'Wire received',
      'Needs review',
      'Proof submitted',
      'Confirmed',
      'Rejected',
    ]),
    choice('kind', ['Client', 'Elite']),
    { name: 'date', type: 'date', required: true },
    { name: 'proof', type: 'checkbox' },
    { name: 'proofFile', type: 'upload', relationTo: 'payment-proofs' },
    { name: 'reviewNotes', type: 'textarea', maxLength: 5000 },
  ],
}
export const PaymentProofs: CollectionConfig = {
  slug: 'payment-proofs',
  admin: { group: 'Income operations' },
  access: {
    read: staffAccess,
    create: managerAccess,
    update: managerAccess,
    delete: managerAccess,
  },
  upload: {
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, no-store')
      return headers
    },
  },
  fields: [text('description')],
}
export const Activity: CollectionConfig = {
  slug: 'activity',
  admin: { useAsTitle: 'title', group: 'Income operations' },
  access: { read: staffAccess, create: noAccess, update: noAccess, delete: noAccess },
  fields: [
    text('title', true),
    text('recordId'),
    text('recordType'),
    text('actor'),
    { name: 'detail', type: 'textarea' },
  ],
}
export const Communications: CollectionConfig = {
  slug: 'communications',
  admin: { useAsTitle: 'subject', group: 'Income operations' },
  access: { read: managerAccess, create: noAccess, update: noAccess, delete: noAccess },
  fields: [
    text('subject', true),
    { name: 'recipient', type: 'email', required: true },
    text('recordId'),
    text('kind'),
    choice('status', ['pending', 'sent', 'failed', 'not-configured'], 'pending'),
    text('providerId'),
    text('error'),
  ],
}
export const TeamMembers: CollectionConfig = {
  ...base('team-members', 'name'),
  access: { read: staffAccess, create: managerAccess, update: managerAccess, delete: noAccess },
  fields: [
    text('name', true),
    text('role', true),
    { name: 'email', type: 'email' },
    text('availableFrom'),
    text('availableUntil'),
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
export const WorkspaceSettings: CollectionConfig = {
  ...base('workspace-settings', 'workspace'),
  access: { read: staffAccess, create: managerAccess, update: managerAccess, delete: noAccess },
  fields: [
    text('workspace', true),
    text('timezone', true),
    { name: 'notifications', type: 'checkbox', defaultValue: true },
  ],
}
