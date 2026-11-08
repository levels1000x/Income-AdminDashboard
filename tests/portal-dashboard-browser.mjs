import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

// Deterministic UI-only fixtures. Application data is still exclusively Payload.
// Network interception verifies controls without creating accounts or sending email.
const base = process.env.PORTAL_TEST_URL || 'http://localhost:3000'
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9222'
assert.equal(
  (await fetch(`${base}/api/portal`)).status,
  401,
  'anonymous callers cannot read the private dashboard',
)
const target = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
const errors = []
const actions = []
const now = new Date().toISOString()
const fixture = {
  user: {
    id: 'staff-admin',
    name: 'Income Administrator',
    email: 'admin@example.test',
    canManage: true,
    cms: false,
  },
  leads: [
    {
      id: 'apply:101',
      documentId: 'doc-application',
      updatedAt: now,
      name: 'Alex Rivera',
      email: 'alex@example.test',
      source: 'Apply',
      service: 'Funding',
      qualification: 'Qualified',
      sales: 'Not started',
      owner: 'Advisor',
      company: 'Rivera Studio',
      phone: '',
      notes: '',
      nextAction: '',
      followUp: '',
      received: now,
      answers: [],
    },
    {
      id: 'webinar:101',
      documentId: 'doc-registrant',
      updatedAt: now,
      name: 'Sam Wilson',
      email: 'sam@example.test',
      source: 'Webinar',
      service: 'Webinar',
      qualification: 'Not applicable',
      sales: 'Not started',
      owner: 'Advisor',
      company: '',
      phone: '',
      notes: '',
      nextAction: '',
      followUp: '',
      received: now,
      answers: [],
      webinar: 'session-1',
      registrationStatus: 'Registered',
      attendance: 'Not recorded',
      followUpStatus: 'Not started',
    },
  ],
  appointments: [
    {
      id: 'appointment:101',
      documentId: 'doc-appointment',
      updatedAt: now,
      leadId: 'apply:101',
      title: 'Strategy call',
      start: now,
      minutes: 30,
      owner: 'Advisor',
      status: 'Scheduled',
      outcome: '',
      cancellationReason: '',
      meetingURL: '',
    },
  ],
  payments: [
    {
      id: 'payment:101',
      documentId: 'doc-payment',
      updatedAt: now,
      name: 'Alex Rivera',
      service: 'Funding',
      amount: 1000,
      status: 'Needs review',
      kind: 'Client',
      date: now,
      proof: false,
    },
  ],
  webinars: [
    {
      id: 'session-1',
      updatedAt: now,
      title: 'Business funding briefing',
      startsAt: now,
      timezone: 'America/New_York',
      host: 'Advisor',
      duration: 60,
      capacity: 250,
      status: 'Scheduled',
      registrationOpen: true,
      waitlistEnabled: true,
      joinURL: '',
      hostURL: '',
      replayURL: '',
      replayPublished: false,
      description: 'Funding options and next steps.',
      cancellationReason: '',
    },
  ],
  preferences: { workspace: 'Income', timezone: 'America/New_York', notifications: true },
  team: [
    {
      id: 'host-1',
      name: 'Advisor',
      role: 'Advisor',
      availableFrom: '09:00',
      availableUntil: '17:00',
    },
  ],
  activities: [],
  users: [],
  messages: [],
  emailConfigured: false,
}
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
const fulfill = (requestId, data, status = 200) =>
  command('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(data)).toString('base64'),
  })
socket.addEventListener('message', async (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id) {
    const handlers = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handlers?.reject(new Error(message.error.message))
    else handlers?.resolve(message.result)
  }
  if (message.method === 'Runtime.exceptionThrown')
    errors.push(
      message.params.exceptionDetails.exception?.description ||
        message.params.exceptionDetails.text,
    )
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = message.params.args.map((a) => a.value || a.description || '').join(' ')
    if (message.params.type === 'error' || /hydration|Invalid hook call|Cannot update a component/i.test(text)) errors.push(text)
  }
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params
    if (request.method === 'GET') {
      await fulfill(requestId, fixture)
      return
    }
    const input = JSON.parse(request.postData)
    actions.push(input)
    if (input.action === 'createLead')
      fixture.leads.push({
        ...fixture.leads[0],
        ...input.data,
        id: 'manual:new',
        documentId: 'doc-new',
        updatedAt: now,
        received: now,
        answers: [],
      })
    else if (input.action === 'archiveLead' || input.action === 'saveLead') {
      const lead = fixture.leads.find((l) => l.documentId === input.id)
      assert.ok(lead, 'mutations target the document ID')
      assert.equal(input.updatedAt, lead.updatedAt, 'mutations carry the record version')
      Object.assign(lead, input.data)
    } else if (input.action === 'createAppointment') {
      fixture.appointments.push({
        ...input.data,
        id: 'appointment:new',
        documentId: 'doc-appointment-new',
        updatedAt: now,
        leadId: 'apply:101',
      })
    } else if (input.action === 'saveAppointment') {
      assert.equal(input.id, 'doc-appointment')
      assert.equal(input.data.lead, 'doc-application')
      Object.assign(fixture.appointments[0], input.data)
    } else if (input.action === 'saveWebinar') Object.assign(fixture.webinars[0], input.data)
    else if (input.action === 'createWebinar')
      fixture.webinars.push({
        ...input.data,
        id: `session-${fixture.webinars.length + 1}`,
        updatedAt: now,
      })
    else if (input.action === 'savePayment') Object.assign(fixture.payments[0], input.data)
    else if (input.action === 'savePreferences') Object.assign(fixture.preferences, input.data)
    await fulfill(requestId, { ok: true, message: 'Changes saved.' })
  }
})
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result?.value
}
const wait = async (expression, label) => {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const click = (text, scope = 'body') =>
  evaluate(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(`${scope} button`)})].find(el => el.textContent.trim() === ${JSON.stringify(text)});
  if (!el) throw new Error('Missing control: ' + ${JSON.stringify(text)});
  el.click();
})()`)
const fill = (label, value, scope = 'body') =>
  evaluate(`(() => {
  const field = [...document.querySelectorAll(${JSON.stringify(`${scope} .MuiFormControl-root`)})].find(el => el.querySelector('label')?.textContent.replace(/\\s*\\*$/, '').trim() === ${JSON.stringify(label)});
  const input = field?.querySelector('input, textarea:not([aria-hidden="true"])');
  if (!input) throw new Error('Missing field: ' + ${JSON.stringify(label)});
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
const select = async (label, value, scope = 'body') => {
  await evaluate(`(() => {
    const field = [...document.querySelectorAll(${JSON.stringify(`${scope} .MuiFormControl-root`)})].find(el => el.querySelector('label')?.textContent.replace(/\\s*\\*$/, '').trim() === ${JSON.stringify(label)});
    field?.querySelector('[role="combobox"]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  })()`)
  await wait(`document.querySelector('[role="option"]')`, `${label} options`)
  await evaluate(
    `(() => { const option = [...document.querySelectorAll('[role="option"]')].find(el => el.textContent.trim() === ${JSON.stringify(value)}); if (!option) throw new Error('Missing option'); option.click(); })()`,
  )
}
const route = async (hash, heading) => {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await wait(`document.querySelector('h1')?.textContent === ${JSON.stringify(heading)}`, heading)
}
try {
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/portal', requestStage: 'Request' }],
  })
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await command('Page.navigate', { url: base })
  await wait(
    `document.querySelector('h1')?.textContent === 'A clear view. A focused day.'`,
    'Income dashboard',
  )
  await evaluate(`window.confirm = () => true`)
  await route('#/leads', 'Leads')
  await click('New lead')
  await wait(`document.querySelector('[role="dialog"]')`, 'new lead form')
  await fill('Name', 'New applicant', '[role="dialog"]')
  await fill('Email', 'new@example.test', '[role="dialog"]')
  await click('Create record', '[role="dialog"]')
  await wait(`!document.querySelector('[role="dialog"]')`, 'lead created')
  assert.equal(actions.at(-1).action, 'createLead')
  await route('#/leads/apply%3A101', 'Alex Rivera')
  await click('Archive lead')
  await fill('Archive reason', 'No longer pursuing funding', '[role="dialog"]')
  await click('Archive lead', '[role="dialog"]')
  await wait(`document.querySelector('h1')?.textContent === 'Leads'`, 'archive returns to list')
  assert.equal(fixture.leads[0].archived, true)
  await click('Archived leads')
  await click('Restore', '[role="dialog"]')
  await wait(
    `!document.querySelector('[role="dialog"]').textContent.includes('Alex Rivera')`,
    'restore removes archived row',
  )
  await click('Close', '[role="dialog"]')
  console.log('PASS Income lead create, archive and restore controls')

  await route('#/leads/webinar%3A101', 'Sam Wilson')
  await select('Registration status', 'Confirmed')
  await select('Attendance', 'Attended')
  await select('Follow-up status', 'Applied')
  await click('Save follow-up')
  await wait(
    `document.querySelector('.ip-record-actions')?.dataset.dirty === 'false'`,
    'webinar follow-up saved',
  )
  assert.equal(fixture.leads[1].registrationStatus, 'Confirmed')
  assert.equal(fixture.leads[1].attendance, 'Attended')
  assert.equal(fixture.leads[1].followUpStatus, 'Applied')
  console.log('PASS separate webinar status dimensions reach the backend action')

  await route('#/calendar/appointment%3A101', 'Strategy call')
  await click('Reschedule / edit')
  const rescheduled = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  await fill('Start (UTC)', rescheduled, '[role="dialog"]')
  await click('Save appointment', '[role="dialog"]')
  await wait(`!document.querySelector('[role="dialog"]')`, 'appointment rescheduled')
  assert.equal(fixture.appointments[0].start, `${rescheduled}:00.000Z`)
  await click('Cancel appointment')
  await fill('Cancellation reason', 'Requested by attendee', '[role="dialog"]')
  await click('Confirm cancellation', '[role="dialog"]')
  await wait(`!document.querySelector('[role="dialog"]')`, 'appointment cancellation')
  assert.equal(fixture.appointments[0].status, 'Cancelled')
  assert.equal(fixture.appointments[0].cancellationReason, 'Requested by attendee')
  console.log('PASS dedicated appointment cancellation retains explicit application relationship')
  await route('#/calendar', 'Calendar')
  await click('New appointment')
  await select('Application', 'Alex Rivera · Apply', '[role="dialog"]')
  await fill('Start (UTC)', rescheduled, '[role="dialog"]')
  await click('Save appointment', '[role="dialog"]')
  await wait(`!document.querySelector('[role="dialog"]')`, 'new appointment saved')
  assert.equal(actions.at(-1).action, 'createAppointment')
  console.log('PASS appointment creation and rescheduling controls')

  await route('#/webinars/session-1', 'Business funding briefing')
  await fill('Session title', 'Income session updated')
  await click('Save session')
  await wait(
    `document.querySelector('h1')?.textContent === 'Income session updated'`,
    'session changes saved',
  )
  await click('Replay')
  await fill('Recording / replay link (HTTPS)', 'https://example.test/replay')
  await click('Save session')
  await wait(
    `!document.querySelector('main').textContent.includes('Saving changes…')`,
    'replay save settles',
  )
  assert.equal(fixture.webinars[0].replayURL, 'https://example.test/replay')
  await click('Communications')
  assert.ok(
    await evaluate(
      `document.querySelector('.ip-main-content').textContent.includes('No messages have been sent')`,
    ),
  )
  await route('#/settings', 'Settings')
  await click('Users & invitations', '.ip-settings-nav')
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('button')].find(b => b.textContent === 'Invite team member').disabled`,
    ),
    true,
  )
  assert.ok(
    await evaluate(
      `document.querySelector('.ip-settings-content').textContent.includes('Connect Resend')`,
    ),
  )
  await click('Webinar room', '.ip-settings-nav')
  await click('Manage webinars')
  await wait(
    `document.querySelector('h1')?.textContent === 'Webinars'`,
    'settings links into Income webinar workspace',
  )
  console.log(
    'PASS webinar management, replay editing, invitation configuration state, and dashboard navigation',
  )

  for (const width of [320, 390, 768, 1280]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
    for (const [hash, heading] of [
      ['#/leads', 'Leads'],
      ['#/calendar', 'Calendar'],
      ['#/webinars', 'Webinars'],
      ['#/settings', 'Settings'],
    ]) {
      await route(hash, heading)
      await new Promise((resolve) => setTimeout(resolve, 100))
      assert.equal(
        await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`),
        true,
        `${heading} fits at ${width}px`,
      )
    }
  }
  await route('#/webinars/session-1', 'Income session updated')
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: true,
  })
  const image = await command('Page.captureScreenshot', { format: 'png' })
  await writeFile('/tmp/income-webinar-dashboard-mobile.png', Buffer.from(image.data, 'base64'))
  assert.deepEqual(errors, [], 'no hydration warnings or runtime exceptions')
  console.log('PASS responsive Income screens at 320, 390, 768 and 1280px; no runtime exceptions')
} catch (error) {
  console.error(await evaluate(`JSON.stringify({ heading: document.querySelector('h1')?.textContent, content: document.querySelector('main')?.textContent, hash: location.hash })`))
  console.error(errors)
  throw error
} finally {
  await fetch(`${debug}/json/close/${target.id}`).catch(() => {})
  socket.close()
}
