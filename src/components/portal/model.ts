export type Section = 'overview' | 'leads' | 'calendar' | 'payments' | 'settings' | 'webinars'
export type Source =
  | 'Apply'
  | 'Invest'
  | 'Capital acquisition'
  | 'Credit partners'
  | 'Webinar'
  | 'Manual'
export type Queue = 'all' | 'attention' | 'booked' | 'unassigned'
export type Lead = {
  documentId?: string
  updatedAt?: string
  archived?: boolean
  archiveReason?: string
  webinar?: string
  registrationStatus?: string
  followUpStatus?: string
  taskCompleted?: boolean
  linkedApplication?: string
  id: string
  name: string
  email: string
  phone: string
  company: string
  source: Source
  service: string
  qualification: string
  sales: string
  owner: string
  nextAction: string
  followUp: string
  received: string
  notes: string
  session?: string
  attendance?: string
  engagement?: string
  operationalStatus?: string
  answers: Array<[string, string]>
}
export type Appointment = {
  documentId?: string
  updatedAt?: string
  meetingURL?: string
  cancellationReason?: string
  id: string
  leadId: string
  title: string
  start: string
  minutes: number
  owner: string
  status: 'Scheduled' | 'Completed' | 'No-show' | 'Cancelled'
  outcome: string
}
export type Payment = {
  documentId?: string
  updatedAt?: string
  reviewNotes?: string
  proofURL?: string
  id: string
  name: string
  service: string
  amount: number
  status: string
  kind: 'Client' | 'Elite'
  date: string
  proof: boolean
}
export type LeadFilters = {
  query: string
  source: string
  queue: Queue
  owner: string
  sort: string
}
export const initialFilters: LeadFilters = {
  query: '',
  source: 'All sources',
  queue: 'all',
  owner: 'Everyone',
  sort: 'Newest first',
}
export const sources: Source[] = [
  'Apply',
  'Invest',
  'Capital acquisition',
  'Credit partners',
  'Webinar',
  'Manual',
]
export let owners = ['Unassigned']
export function setOwners(names: string[]) {
  owners = ['Unassigned', ...names]
}
export const demoToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
export const demoNow = `${demoToday}T00:00`

export function needsAttention(lead: Lead) {
  if (
    lead.archived ||
    lead.taskCompleted ||
    ['Closed', 'Won', 'Lost', 'Disqualified'].includes(lead.sales)
  )
    return false
  return (
    ['Needs review', 'Manual review', 'Incomplete'].includes(lead.qualification) ||
    (lead.followUpStatus ?? lead.operationalStatus) === 'Follow-Up Needed' ||
    Boolean(lead.followUp && lead.followUp.slice(0, 10) <= demoToday) ||
    lead.owner === 'Unassigned'
  )
}
export function filterLeads(leads: Lead[], filters: LeadFilters, appointments: Appointment[]) {
  const query = filters.query.trim().toLowerCase()
  const booked = new Set(appointments.filter((a) => a.status === 'Scheduled').map((a) => a.leadId))
  return leads
    .filter(
      (lead) =>
        (filters.source === 'All sources' ||
          lead.source === filters.source ||
          (filters.source === 'Applications' && lead.source !== 'Webinar')) &&
        (filters.owner === 'Everyone' || lead.owner === filters.owner) &&
        (filters.queue === 'all' ||
          (filters.queue === 'attention' && needsAttention(lead)) ||
          (filters.queue === 'unassigned' && lead.owner === 'Unassigned') ||
          (filters.queue === 'booked' && booked.has(lead.id))) &&
        (!query ||
          [lead.name, lead.email, lead.phone, lead.company, lead.service].some((v) =>
            v.toLowerCase().includes(query),
          )),
    )
    .sort((a, b) =>
      filters.sort === 'Name A–Z'
        ? a.name.localeCompare(b.name)
        : filters.sort === 'Oldest first'
          ? a.received.localeCompare(b.received)
          : b.received.localeCompare(a.received),
    )
}
export function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
export function formatDate(value: string, timezone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(
    new Date(
      value.length === 10 || value.length === 16 ? `${value.slice(0, 10)}T12:00:00-04:00` : value,
    ),
  )
}
export function dayKey(value: string, timezone = 'America/New_York') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const get = (key: string) => parts.find((p) => p.type === key)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function shiftDay(date: string, amount: number) {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + amount)
  return result.toISOString().slice(0, 10)
}
export function timeLabel(date: string, timezone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(date))
}
export function timezoneAbbreviation(date: string, timezone = 'America/New_York') {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date(date))
      .find((part) => part.type === 'timeZoneName')?.value ?? timezone
  )
}
export function exportLeads(rows: Lead[]) {
  const escape = (value: string) =>
    `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`
  const columns = [
    'Name',
    'Email',
    'Source',
    'Qualification',
    'Sales stage',
    'Owner',
    'Next action',
    'Follow-up (UTC)',
    'Registration status',
    'Attendance',
    'Engagement',
    'Follow-up status',
  ]
  return [
    columns,
    ...rows.map((l) => [
      l.name,
      l.email,
      l.source,
      l.qualification,
      l.sales,
      l.owner,
      l.nextAction,
      l.followUp,
      l.source === 'Webinar' ? (l.registrationStatus ?? 'Registered') : '',
      l.source === 'Webinar' ? (l.attendance ?? '') : '',
      l.source === 'Webinar' ? (l.engagement ?? '') : '',
      l.source === 'Webinar' ? (l.followUpStatus ?? 'Not started') : '',
    ]),
  ]
    .map((row) => row.map(escape).join(','))
    .join('\r\n')
}
