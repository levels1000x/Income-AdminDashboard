import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { defaultAlertPreferences } from '../src/lib/portal-notifications.ts'

// UI integration with an isolated clock, AudioContext spy, and intercepted data.
// No real users, records, email, or OS notifications are mutated by this test.
const base = process.env.PORTAL_TEST_URL || 'http://localhost:3000'
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9222'
assert.equal((await fetch(`${base}/api/portal-alerts`)).status, 401)
assert.equal((await fetch(`${base}/api/appointment-calendar?id=not-a-real-record`)).status, 401)
const target = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
const errors = []
let time = Date.now()
const preferences = { ...defaultAlertPreferences }
const incoming = []
let calls = []
let followUps = [
  {
    id: 'apply:old',
    documentId: 'old-followup',
    name: 'Earlier task',
    nextAction: 'Review',
    followUp: new Date(time - 3600000).toISOString(),
  },
]
let polls = 0
let fullReads = 0
const writes = []
const lead = {
  id: 'apply:editor',
  documentId: 'editor-doc',
  updatedAt: new Date(time).toISOString(),
  name: 'Editing Applicant',
  email: 'editor@example.test',
  phone: '',
  company: 'Test studio',
  source: 'Apply',
  service: 'Funding',
  qualification: 'Qualified',
  sales: 'Not started',
  owner: 'Advisor',
  nextAction: 'Original next step',
  followUp: '',
  received: new Date(time).toISOString(),
  notes: '',
  answers: [],
}
const data = {
  user: {
    id: `alerts-test-${time}`,
    name: 'Test staff',
    email: 'staff@example.test',
    canManage: true,
    cms: false,
  },
  leads: [lead],
  appointments: [],
  payments: [],
  webinars: [],
  team: [{ id: 'advisor', name: 'Advisor', availableFrom: '09:00', availableUntil: '17:00' }],
  preferences: { workspace: 'Income', timezone: 'America/New_York', notifications: true },
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
const reply = (requestId, value, status = 200) =>
  command('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(value)).toString('base64'),
  })
socket.addEventListener('message', (event) => {
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
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params
    const url = new URL(request.url)
    if (url.pathname === '/api/portal') {
      fullReads++
      void reply(requestId, data)
      return
    }
    if (request.method === 'PUT') {
      const value = JSON.parse(request.postData)
      writes.push(value)
      Object.assign(preferences, value)
      void reply(requestId, { ok: true, preferences })
      return
    }
    polls++
    const since = url.searchParams.get('since')
    void reply(requestId, {
      preferences,
      workspaceEnabled: true,
      serverTime: new Date(time).toISOString(),
      until: new Date(time).toISOString(),
      nextPage: null,
      newLeads: since
        ? incoming.filter((row) => Date.parse(row.createdAt) >= Date.parse(since))
        : [],
      calls,
      followUps,
    })
  }
})
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result?.value
}
const until = async (predicate, label) => {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const wait = (expression, label) => until(() => evaluate(`Boolean(${expression})`), label)
const poll = async () => {
  const before = polls
  await until(async () => {
    if (polls > before) return true
    await evaluate(`window.__tick(30000)`)
    return false
  }, 'alert poll')
  await new Promise((resolve) => setTimeout(resolve, 100))
}
const advance = async (milliseconds) => {
  time += milliseconds
  await evaluate(`window.__clock = ${time}`)
}
const fill = (label, value) =>
  evaluate(`(() => {
  const field = [...document.querySelectorAll('.MuiFormControl-root')].find(el => el.querySelector('label')?.textContent.trim() === ${JSON.stringify(label)});
  const input = field?.querySelector('input'); if (!input) throw new Error('Missing field');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
const toggle = (label) =>
  evaluate(`(() => {
  const item = [...document.querySelectorAll('.MuiFormControlLabel-root')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
  if (!item) throw new Error('Missing switch');
  item.querySelector('input').click();
})()`)
const click = (label, scope = 'body') =>
  evaluate(
    `(() => { const button = [...document.querySelectorAll(${JSON.stringify(`${scope} button`)})].find(el => el.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw new Error('Missing button'); button.click(); })()`,
  )
try {
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    window.__clock = ${time}; Date.now = () => window.__clock;
    window.__tones = 0; window.__audioContexts = 0;
    const intervals = new Map();
    const originalInterval = window.setInterval.bind(window), originalClear = window.clearInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => {
      if (delay !== 15000 && delay !== 30000) return originalInterval(callback, delay, ...args);
      const id = originalInterval(() => {}, 3600000); intervals.set(id, { callback, delay }); return id;
    };
    window.clearInterval = id => { intervals.delete(id); originalClear(id); };
    window.__tick = delay => { for (const task of intervals.values()) if (task.delay === delay) task.callback(); };
    window.AudioContext = class {
      state = 'suspended'; currentTime = 0; destination = {};
      constructor() { window.__audioContexts++; }
      async resume() { this.state = 'running'; }
      async close() { this.state = 'closed'; }
      createOscillator() { return { frequency: { value: 0 }, connect() {}, disconnect() {}, start() { window.__tones++; }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    };
    window.confirm = () => true;
  `,
  })
  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/portal*', requestStage: 'Request' }],
  })
  await command('Page.navigate', { url: base })
  await wait(
    `document.querySelector('[aria-label="Enable notification sound"]')?.disabled === false`,
    'alert connection',
  )
  assert.equal(
    await evaluate('window.__tones'),
    0,
    'login does not replay existing leads or overdue tasks',
  )
  assert.equal(
    await evaluate('window.__audioContexts'),
    0,
    'audio is not initialized before a user gesture',
  )
  await evaluate(`location.hash = '#/leads/apply%3Aeditor'`)
  await wait(`document.querySelector('h1')?.textContent === 'Editing Applicant'`, 'lead editor')
  await fill('Next action', 'Unsaved work must stay intact')
  await wait(`document.querySelector('.ip-record-actions').dataset.dirty === 'true'`, 'dirty lead')
  await evaluate(`document.querySelector('[aria-label="Enable notification sound"]').click()`)
  await wait(`document.querySelector('[aria-label="Mute alert sound"]')`, 'audio enabled')
  assert.equal(
    await evaluate('window.__tones'),
    2,
    'the deliberate enable click plays a test chime',
  )
  await advance(4000)
  incoming.push({
    id: 'apply:new',
    documentId: 'new-doc',
    name: 'New applicant',
    source: 'Apply',
    createdAt: new Date(time).toISOString(),
  })
  const reads = fullReads
  await poll()
  await wait(
    `document.querySelector('.MuiSnackbar-root')?.textContent.includes('New lead received')`,
    'new lead alert',
  )
  await wait(`window.__tones === 4`, 'new lead ding')
  assert.equal(fullReads, reads, 'alert polling does not reload editable records')
  assert.equal(await evaluate(`document.querySelector('.ip-record-actions').dataset.dirty`), 'true')
  assert.equal(
    await evaluate(
      `document.querySelector('input[value="Unsaved work must stay intact"]') !== null`,
    ),
    true,
  )
  await poll()
  assert.equal(await evaluate('window.__tones'), 4, 'a repeated native ID does not ring again')
  console.log('PASS initial baseline, real new-ID detection, one chime, and draft-safe refresh')

  await evaluate(`document.querySelector('[aria-label="Open work reminders"]').click()`)
  await wait(`document.querySelector('[role="dialog"]')`, 'reminder center')
  await click('Settings', '[role="dialog"]')
  await toggle('Play a ding for new alerts')
  await until(() => preferences.soundEnabled === false, 'muted preference persisted')
  await advance(4000)
  incoming.push({
    id: 'webinar:new',
    documentId: 'webinar-doc',
    name: 'Registrant',
    source: 'Webinar',
    createdAt: new Date(time).toISOString(),
  })
  await poll()
  await wait(
    `document.querySelector('.MuiSnackbar-root').textContent.includes('New webinar registration')`,
    'webinar remains distinct',
  )
  assert.equal(await evaluate('window.__tones'), 4, 'muting prevents alert sound')
  await toggle('Play a ding for new alerts')
  await until(() => preferences.soundEnabled === true, 'sound restored')
  await click('Alerts', '[role="dialog"]')
  calls = [
    {
      id: 'appointment:soon',
      documentId: 'soon-doc',
      title: 'Upcoming strategy call',
      owner: 'Advisor',
      status: 'Scheduled',
      start: new Date(time + 9 * 60000).toISOString(),
    },
  ]
  await poll()
  await wait(`window.__tones === 6`, 'advance call reminder')
  await click('Snooze 5 minutes')
  await wait(
    `!document.querySelector('[role="dialog"]').textContent.includes('Call in 9 minutes')`,
    'reminder snoozed',
  )
  await advance(4 * 60000)
  await poll()
  assert.equal(await evaluate('window.__tones'), 6, 'snoozing suppresses repeats')
  await advance(2 * 60000)
  await poll()
  await wait(`window.__tones === 8`, 'snoozed reminder becomes due')
  calls = []
  await poll()
  await wait(
    `!document.querySelector('[role="dialog"]').textContent.includes('Upcoming strategy call')`,
    'cancelled call removed',
  )
  console.log(
    'PASS stored mute setting, webinar alerts, timed calls, snoozing and cancellation cleanup',
  )

  await advance(4000)
  calls = [
    {
      id: 'appointment:start',
      documentId: 'start-doc',
      title: 'Start reminder test',
      owner: 'Advisor',
      status: 'Scheduled',
      start: new Date(time + 60000).toISOString(),
    },
  ]
  await poll()
  await wait(`window.__tones === 10`, 'near-start advance reminder')
  await advance(2 * 60000)
  await poll()
  await wait(`window.__tones === 12`, 'call start reminder')
  calls = []
  followUps.push({
    id: 'apply:due',
    documentId: 'due-doc',
    name: 'Due applicant',
    nextAction: 'Send requirements',
    followUp: new Date(time + 60000).toISOString(),
  })
  await poll()
  await advance(75000)
  await poll()
  await wait(`window.__tones === 14`, 'newly due follow-up')
  await evaluate(
    `window.Notification = class { static permission = 'default'; static async requestPermission() { return 'denied'; } }`,
  )
  await click('Settings', '[role="dialog"]')
  await toggle('Browser notifications when this tab is in the background')
  await wait(
    `document.querySelector('[role="dialog"]').textContent.includes('were declined')`,
    'permission denial feedback',
  )
  assert.equal(preferences.desktopEnabled, false)
  assert.equal(
    writes.some((value) => value.desktopEnabled),
    false,
    'denied permission is never represented as enabled',
  )
  for (const width of [320, 768, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 768,
    })
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`),
      true,
      `notifications fit at ${width}px`,
    )
  }
  const image = await command('Page.captureScreenshot', { format: 'png' })
  await writeFile('/tmp/income-notification-center.png', Buffer.from(image.data, 'base64'))
  assert.deepEqual(errors, [])
  console.log(
    'PASS call-start and follow-up reminders, graceful browser permission denial, and responsive controls',
  )
} finally {
  await fetch(`${debug}/json/close/${target.id}`).catch(() => {})
  socket.close()
}
