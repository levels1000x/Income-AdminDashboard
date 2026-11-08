import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { APIError } from 'payload'
import * as access from '../src/lib/portal-access.ts'

// Execute the actual collection hooks against isolated Local API doubles.
// This tests durable invariants without writing or deleting real Payload data.
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/collections/Portal.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)(
  (name) => {
    if (name === 'payload') return { APIError }
    if (name === '../lib/portal-access') return access
    throw new Error(`Unexpected collection dependency: ${name}`)
  },
  module,
  module.exports,
)
const { Leads, Appointments, Users } = module.exports
const appointmentRule = Appointments.hooks.beforeChange[0]
const registrationRule = Leads.hooks.beforeChange[0]
const call = {
  lead: 'application-id',
  title: 'Strategy call',
  start: '2026-11-09T15:00:00Z',
  minutes: 30,
  owner: 'Advisor',
  status: 'Scheduled',
}
const request = (overrides = {}) => ({
  user: { collection: 'admins', id: 'admin-id' },
  context: {},
  payload: {
    findByID: async () => ({ id: 'application-id', source: 'Apply', archived: false }),
    find: async ({ collection }) => ({
      docs:
        collection === 'team-members'
          ? [{ name: 'Advisor', availableFrom: '09:00', availableUntil: '17:00' }]
          : [],
    }),
    ...overrides,
  },
})
test('scheduled appointments must fit the configured host working hours', async () => {
  await assert.doesNotReject(() => appointmentRule({ data: call, req: request() }))
  await assert.rejects(
    () => appointmentRule({ data: { ...call, start: '2026-11-09T23:00:00Z' }, req: request() }),
    /working hours/,
  )
})
test('unknown scheduling hosts are rejected at the collection boundary', async () => {
  await assert.rejects(
    () => appointmentRule({ data: call, req: request({ find: async () => ({ docs: [] }) }) }),
    /active scheduling host/,
  )
})
test('overlapping appointments for the same host are rejected', async () => {
  const req = request({
    find: async ({ collection }) => ({
      docs:
        collection === 'team-members'
          ? [{ name: 'Advisor' }]
          : [{ id: 'other', start: call.start, minutes: 30 }],
    }),
  })
  await assert.rejects(() => appointmentRule({ data: call, req }), /overlapping/)
})
test('an archived source application can still have its existing appointment cancelled', async () => {
  const req = request({ findByID: async () => ({ source: 'Apply', archived: true }) })
  await assert.doesNotReject(() =>
    appointmentRule({
      data: { status: 'Cancelled', cancellationReason: 'Requested by attendee' },
      originalDoc: call,
      req,
    }),
  )
  await assert.rejects(
    () => appointmentRule({ data: { status: 'Cancelled' }, originalDoc: call, req }),
    /cancellation reason/,
  )
})
test('capacity is checked when promoting a waitlisted registration', async () => {
  const req = request({
    findByID: async () => ({
      id: 'session',
      status: 'Scheduled',
      registrationOpen: true,
      waitlistEnabled: true,
      capacity: 1,
    }),
    count: async () => ({ totalDocs: 1 }),
  })
  const originalDoc = { source: 'Webinar', webinar: 'session', registrationStatus: 'Waitlisted' }
  await assert.rejects(
    () => registrationRule({ data: { registrationStatus: 'Confirmed' }, originalDoc, req }),
    /Capacity reached/,
  )
})
test('a disabled waitlist cannot accept new waitlisted registrations', async () => {
  const req = request({
    findByID: async () => ({
      id: 'session',
      status: 'Scheduled',
      registrationOpen: true,
      waitlistEnabled: false,
    }),
  })
  await assert.rejects(
    () =>
      registrationRule({
        data: { source: 'Webinar', webinar: 'session', registrationStatus: 'Waitlisted' },
        req,
      }),
    /waitlist is not enabled/,
  )
})
test('staff account activation requires server-owned invitation context', async () => {
  const req = { user: { collection: 'users', id: 'invited-id', status: 'invited' }, context: {} }
  assert.equal(await Users.access.update({ req, id: 'invited-id' }), false)
  req.context.acceptPortalInvitation = 'invited-id'
  assert.equal(await Users.access.update({ req, id: 'invited-id' }), true)
  assert.equal(await Users.access.update({ req, id: 'another-id' }), false)
})
