import test from 'node:test'
import assert from 'node:assert/strict'
import {
  leadFields,
  leadUpdate,
  appointmentFields,
  webinarFields,
  calendarFile,
} from '../src/lib/portal-validation.ts'
import { isStaff, isManager } from '../src/lib/portal-access.ts'
import {
  filterLeads,
  initialFilters,
  needsAttention,
  exportLeads,
} from '../src/components/portal/model.ts'

const lead = {
  id: 'apply:101',
  source: 'Apply',
  name: 'Alex Rivera',
  email: 'alex@example.test',
  phone: '',
  company: 'Rivera Studio',
  service: 'Funding',
  owner: 'Advisor',
  qualification: 'Qualified',
  sales: 'Not started',
  nextAction: '',
  followUp: '',
  notes: '',
  received: '2026-11-09T14:00:00Z',
  answers: [],
}
test('anonymous and disabled identities cannot operate the portal', () => {
  assert.equal(isStaff(null), false)
  assert.equal(isStaff({ collection: 'users', role: 'administrator', status: 'disabled' }), false)
  assert.equal(isManager({ collection: 'users', role: 'administrator', status: 'invited' }), false)
})
test('sales staff and managers have distinct administrative permissions', () => {
  assert.equal(isStaff({ collection: 'users', role: 'sales', status: 'active' }), true)
  assert.equal(isManager({ collection: 'users', role: 'sales', status: 'active' }), false)
  assert.equal(isManager({ collection: 'users', role: 'manager', status: 'active' }), true)
  assert.equal(isManager({ collection: 'admins' }), true)
})
test('source-native identity cannot be changed by an update', () => {
  assert.equal(leadUpdate.safeParse({ source: 'Webinar' }).success, false)
  assert.equal(leadUpdate.safeParse({ sourceId: 'other:123' }).success, false)
  assert.equal(leadUpdate.safeParse({ archived: true }).success, false)
  assert.equal(leadUpdate.safeParse({ owner: 'Advisor' }).success, true)
})
test('registration, attendance and follow-up remain independent', () => {
  const parsed = leadUpdate.parse({
    registrationStatus: 'Confirmed',
    attendance: 'No Show',
    followUpStatus: 'Follow-Up Needed',
  })
  assert.equal(parsed.registrationStatus, 'Confirmed')
  assert.equal(parsed.attendance, 'No Show')
  assert.equal(parsed.followUpStatus, 'Follow-Up Needed')
  assert.equal(leadUpdate.safeParse({ registrationStatus: 'Attended' }).success, false)
})
test('partial updates do not reset unrelated webinar dimensions', () => {
  assert.deepEqual(leadUpdate.parse({ owner: 'Maya' }), { owner: 'Maya' })
})
test('creating leads validates the contact and required fields', () => {
  const { id, received, answers, ...data } = lead
  assert.equal(leadFields.safeParse(data).success, true)
  assert.equal(leadFields.safeParse({ ...data, email: 'invalid' }).success, false)
})
test('same contact details never merge application and webinar records', () => {
  const webinar = { ...lead, id: 'webinar:101', source: 'Webinar', qualification: 'Not applicable' }
  const rows = [lead, webinar]
  assert.equal(filterLeads(rows, initialFilters, []).length, 2)
  assert.deepEqual(
    filterLeads(rows, { ...initialFilters, source: 'Applications' }, []).map((r) => r.id),
    ['apply:101'],
  )
})
test('completed tasks and archived leads leave attention queues', () => {
  const row = { ...lead, owner: 'Unassigned' }
  assert.equal(needsAttention(row), true)
  assert.equal(needsAttention({ ...row, archived: true }), false)
  assert.equal(needsAttention({ ...row, taskCompleted: true }), false)
})
test('appointments reject invalid dates, duration and unsafe meeting links', () => {
  const call = {
    lead: 'doc-id',
    title: 'Strategy call',
    start: '2026-11-09T15:00:00Z',
    minutes: 30,
    owner: 'Advisor',
    status: 'Scheduled',
    outcome: '',
    meetingURL: '',
    cancellationReason: '',
  }
  assert.equal(appointmentFields.safeParse(call).success, true)
  assert.equal(appointmentFields.safeParse({ ...call, minutes: 0 }).success, false)
  assert.equal(
    appointmentFields.safeParse({ ...call, meetingURL: 'javascript:alert(1)' }).success,
    false,
  )
})
test('webinars validate timezone, capacity and provider links', () => {
  const session = {
    title: 'Income briefing',
    startsAt: '2026-11-09T20:00:00Z',
    timezone: 'America/New_York',
    host: 'Advisor',
    duration: 60,
    capacity: 250,
    status: 'Draft',
    registrationOpen: false,
    waitlistEnabled: true,
    joinURL: '',
    hostURL: '',
    replayURL: '',
    replayPublished: false,
    description: '',
    cancellationReason: '',
  }
  assert.equal(webinarFields.safeParse(session).success, true)
  assert.equal(webinarFields.safeParse({ ...session, capacity: 0 }).success, false)
  assert.equal(webinarFields.safeParse({ ...session, timezone: 'not-a-zone' }).success, false)
})
test('calendar cancellation retains a stable event identity', () => {
  const call = {
    id: 'native:appointment',
    title: 'Strategy, call',
    start: '2026-11-09T15:00:00Z',
    minutes: 30,
    status: 'Cancelled',
  }
  const ics = calendarFile(call, 'alex@example.test')
  assert.ok(ics.includes('METHOD:CANCEL'))
  assert.ok(ics.includes('STATUS:CANCELLED'))
  assert.ok(ics.includes('SUMMARY:Strategy\\, call'))
  assert.ok(ics.includes('UID:native:appointment@income'))
})
test('exports retain all webinar state dimensions without spreadsheet formulas', () => {
  const csv = exportLeads([
    {
      ...lead,
      source: 'Webinar',
      name: '=SUM(1,2)',
      registrationStatus: 'Confirmed',
      attendance: 'Attended',
      followUpStatus: 'Applied',
    },
  ])
  assert.ok(csv.includes('"Confirmed"'))
  assert.ok(csv.includes('"Attended"'))
  assert.ok(csv.includes('"Applied"'))
  assert.ok(csv.includes(`"'=SUM(1,2)"`))
})
