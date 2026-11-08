import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { APIError } from 'payload'
import * as access from '../src/lib/portal-access.ts'
import {
  callNotices,
  followUpNotices,
  leadNotice,
  isCurrentNotice,
  isAudibleNotice,
  defaultAlertPreferences,
} from '../src/lib/portal-notifications.ts'
import { calendarFile } from '../src/lib/portal-validation.ts'

const now = Date.parse('2026-11-09T15:00:00Z')
const call = {
  id: 'appointment:1',
  documentId: 'call-doc',
  title: 'Strategy call',
  start: '2026-11-09T15:09:00Z',
  owner: 'Advisor',
  status: 'Scheduled',
}
test('call reminders respect the selected advance window', () => {
  assert.equal(callNotices([call], 5, now).length, 0)
  assert.equal(callNotices([call], 10, now).length, 1)
  assert.equal(callNotices([call], 10, now)[0].title, 'Call in 9 minutes')
})
test('call start is a distinct reminder, but old calls never ring as a backlog', () => {
  const advance = callNotices([call], 10, now)[0]
  const start = callNotices([call], 10, Date.parse(call.start))[0]
  assert.notEqual(advance.key, start.key)
  assert.equal(start.title, 'Call starting now')
  assert.equal(callNotices([call], 10, Date.parse(call.start) + 180000).length, 0)
})
test('cancelled, completed and invalid appointments do not generate reminders', () => {
  for (const status of ['Cancelled', 'Completed', 'No-show'])
    assert.equal(callNotices([{ ...call, status }], 10, now).length, 0)
  assert.equal(callNotices([{ ...call, start: 'invalid' }], 10, now).length, 0)
})
test('rescheduling changes the reminder identity; cancellation removes its old inbox entry', () => {
  const notice = callNotices([call], 10, now)[0]
  const snapshot = { calls: [{ ...call, start: '2026-11-09T16:00:00Z' }], followUps: [] }
  assert.equal(isCurrentNotice(notice, snapshot), false)
  assert.equal(isCurrentNotice(notice, { calls: [], followUps: [] }), false)
  assert.equal(isCurrentNotice(notice, { calls: [call], followUps: [] }), true)
})
test('new lead and webinar notices use native document IDs, not matching contact details', () => {
  const lead = {
    id: 'apply:1',
    documentId: 'apply-doc',
    name: 'Same Name',
    source: 'Apply',
    createdAt: new Date(now).toISOString(),
  }
  const webinar = { ...lead, id: 'webinar:1', documentId: 'webinar-doc', source: 'Webinar' }
  assert.notEqual(leadNotice(lead, now).key, leadNotice(webinar, now).key)
  assert.equal(leadNotice(webinar, now).title, 'New webinar registration')
  assert.equal(leadNotice({ ...lead, name: 'Updated Name' }, now).key, leadNotice(lead, now).key)
})
test('follow-up reminders include only due valid timestamps', () => {
  const row = {
    id: 'apply:1',
    documentId: 'apply-doc',
    name: 'Applicant',
    nextAction: 'Send details',
    followUp: '2026-11-09T14:00:00Z',
  }
  assert.equal(followUpNotices([row], now).length, 1)
  assert.equal(followUpNotices([{ ...row, followUp: '2026-11-10T14:00:00Z' }], now).length, 0)
  assert.equal(followUpNotices([{ ...row, followUp: '' }], now).length, 0)
})
test('old follow-up backlogs remain visible without making stale sounds', () => {
  const row = {
    id: 'apply:1',
    documentId: 'apply-doc',
    name: 'Applicant',
    nextAction: '',
    followUp: new Date(now - 60000).toISOString(),
  }
  const notice = followUpNotices([row], now)[0]
  assert.equal(isAudibleNotice(notice, now, now), false)
  assert.equal(isAudibleNotice(notice, now - 3600000, now), true)
  assert.equal(isAudibleNotice(notice, now - 3600000, now + 600000), false)
})
test('personal calendar snapshots include an alarm without inventing an invitation', () => {
  const file = calendarFile({ ...call, minutes: 30 }, '', true)
  assert.ok(file.includes('TRIGGER:-PT10M'))
  assert.ok(file.includes('BEGIN:VALARM'))
  assert.ok(!file.includes('METHOD:REQUEST'))
  assert.ok(!file.includes('ATTENDEE:'))
  assert.ok(file.includes('UID:appointment:1@income'))
})
test('calendar cancellation has no stale alarm', () => {
  const file = calendarFile({ ...call, minutes: 30, status: 'Cancelled' }, 'staff@example.test')
  assert.ok(file.includes('METHOD:CANCEL'))
  assert.ok(!file.includes('VALARM'))
})
test('personal calendar copies respect reminder timing and disabling', () => {
  assert.ok(calendarFile({ ...call, minutes: 30 }, '', true, 5).includes('TRIGGER:-PT5M'))
  assert.ok(!calendarFile({ ...call, minutes: 30 }, '', true, 0).includes('VALARM'))
})
test('browser delivery is opt-in while the default reminder is ten minutes', () => {
  assert.equal(defaultAlertPreferences.desktopEnabled, false)
  assert.equal(defaultAlertPreferences.advanceMinutes, 10)
})

const module = { exports: {} }
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/collections/NotificationPreferences.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText
new Function('require', 'module', 'exports', compiled)(
  (name) => {
    if (name === 'payload') return { APIError }
    if (name === '../lib/portal-access') return access
    throw new Error(`Unexpected dependency ${name}`)
  },
  module,
  module.exports,
)
const collection = module.exports.NotificationPreferences
const req = { user: { id: 'staff-id', collection: 'users', status: 'active' }, context: {} }
test('notification preferences are private to the authenticated recipient', () => {
  assert.equal(collection.access.read({ req: { user: null } }), false)
  assert.deepEqual(collection.access.read({ req }), { recipientKey: { equals: 'users:staff-id' } })
  assert.deepEqual(
    collection.access.read({ req: { ...req, user: { id: 'cms-id', collection: 'admins' } } }),
    { recipientKey: { equals: 'admins:cms-id' } },
  )
})
test('preference ownership is server-owned and cannot be reassigned', () => {
  assert.equal(collection.access.create({ req }), false)
  const trusted = { ...req, context: { alertSettingsWrite: true } }
  assert.equal(collection.access.create({ req: trusted }), true)
  const data = collection.hooks.beforeValidate[0]({
    data: { recipientKey: 'users:other', recipient: { relationTo: 'users', value: 'other' } },
    req: trusted,
    operation: 'create',
  })
  assert.equal(data.recipientKey, 'users:staff-id')
  assert.equal(data.recipient.value, 'staff-id')
  assert.equal(
    collection.fields.find((field) => field.name === 'recipient').access.update({ req: trusted }),
    false,
  )
})
