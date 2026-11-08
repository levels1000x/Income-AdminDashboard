import { z } from 'zod'

const text = z.string().trim().max(500)
const note = z.string().max(5000)
const date = z.string().datetime({ offset: true })
const url = z.union([
  z.literal(''),
  z
    .string()
    .url()
    .refine((v) => v.startsWith('https://'), 'Use an HTTPS link.'),
])
export const leadFields = z
  .object({
    name: text.min(1),
    email: z.string().email(),
    phone: text,
    company: text,
    source: z.enum([
      'Apply',
      'Invest',
      'Capital acquisition',
      'Credit partners',
      'Webinar',
      'Manual',
    ]),
    service: text,
    owner: text,
    qualification: text,
    sales: z.enum([
      'Not started',
      'Conversation started',
      'Call booked',
      'Closed',
      'Won',
      'Lost',
      'Disqualified',
    ]),
    nextAction: text,
    followUp: z.union([z.literal(''), date]),
    notes: note,
    registrationStatus: z.enum(['Registered', 'Confirmed', 'Waitlisted', 'Cancelled']).optional(),
    attendance: z.enum(['Not recorded', 'Registered', 'Attended', 'No Show']).optional(),
    followUpStatus: z.enum(['Not started', 'Follow-Up Needed', 'Contacted', 'Applied']).optional(),
    taskCompleted: z.boolean().optional(),
    linkedApplication: text.nullable().optional(),
    webinar: text.optional(),
  })
  .strict()
export const leadUpdate = leadFields.omit({ source: true, qualification: true }).partial()
export const appointmentFields = z
  .object({
    lead: text.min(1),
    title: text.min(1),
    start: date,
    minutes: z.number().int().min(15).max(240),
    owner: text.min(1),
    status: z.enum(['Scheduled', 'Completed', 'No-show', 'Cancelled']),
    outcome: note,
    meetingURL: url,
    cancellationReason: text,
  })
  .strict()
export const webinarFields = z
  .object({
    title: text.min(1),
    startsAt: date,
    timezone: text.refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v })
        return true
      } catch {
        return false
      }
    }, 'Choose a valid timezone.'),
    host: text.min(1),
    duration: z.number().int().min(15).max(480),
    status: z.enum(['Draft', 'Scheduled', 'Live', 'Completed', 'Cancelled']),
    capacity: z.number().int().min(1).max(10000),
    registrationOpen: z.boolean(),
    waitlistEnabled: z.boolean(),
    joinURL: url,
    hostURL: url,
    replayURL: url,
    replayPublished: z.boolean(),
    description: note,
    cancellationReason: text,
  })
  .strict()
export const envelope = z
  .object({
    action: z.string(),
    id: z.string().optional(),
    updatedAt: z.string().optional(),
    data: z.unknown(),
  })
  .strict()
export function escapeICS(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}
export function calendarFile(
  call: {
    id: string
    title: string
    start: string
    minutes: number
    status: string
    meetingURL?: string | null
  },
  recipient: string,
  personalCopy = false,
  reminderMinutes = 10,
) {
  const stamp = (value: Date) =>
    value
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Income//Admin//EN',
    ...(personalCopy ? [] : [`METHOD:${call.status === 'Cancelled' ? 'CANCEL' : 'REQUEST'}`]),
    'BEGIN:VEVENT',
    `UID:${escapeICS(call.id)}@income`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(call.start))}`,
    `DTEND:${stamp(new Date(new Date(call.start).getTime() + call.minutes * 60000))}`,
    `SUMMARY:${escapeICS(call.title)}`,
    ...(!personalCopy && recipient ? [`ATTENDEE:mailto:${recipient.replace(/[\r\n]/g, '')}`] : []),
    `STATUS:${call.status === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    `URL:${escapeICS(call.meetingURL || '')}`,
    ...(call.status === 'Scheduled' && reminderMinutes > 0
      ? [
          'BEGIN:VALARM',
          `TRIGGER:-PT${reminderMinutes}M`,
          'ACTION:DISPLAY',
          'DESCRIPTION:Income appointment reminder',
          'END:VALARM',
        ]
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
