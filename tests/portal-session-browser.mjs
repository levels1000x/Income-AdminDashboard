import assert from 'node:assert/strict'

// Isolated UI fixtures: never logs out a real user or interacts with CMS SSO.
const base = process.env.PORTAL_TEST_URL || 'http://localhost:3000'
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9222'
const target = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
const requests = []
let mode = 'network'
let authenticated = true
let held
let navigations = 0
const fixture = {
  user: {
    id: 'session-test',
    name: 'Income Staff',
    email: 'staff@example.test',
    canManage: true,
    cms: false,
  },
  leads: [],
  appointments: [],
  payments: [],
  webinars: [],
  team: [],
  users: [],
  messages: [],
  activities: [],
  preferences: { workspace: 'Income', timezone: 'America/New_York', notifications: true },
  emailConfigured: false,
}
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
const reply = (requestId, status, body) =>
  command('Fetch.fulfillRequest', {
    requestId,
    responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64'),
  })
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id) {
    const handlers = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handlers?.reject(new Error(message.error.message))
    else handlers?.resolve(message.result)
  }
  if (message.method === 'Page.frameNavigated' && !message.params.frame.parentId) navigations++
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params
    if (request.method === 'GET') {
      void reply(
        requestId,
        authenticated ? 200 : 401,
        authenticated ? fixture : { error: 'Sign in required.' },
      )
      return
    }
    requests.push(JSON.parse(request.postData))
    if (mode === 'hold') held = requestId
    else if (mode === 'network')
      void command('Fetch.failRequest', { requestId, errorReason: 'Failed' })
    else if (mode === 'server') void reply(requestId, 503, { ok: false })
    else void reply(requestId, 200, 'not-json')
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
const until = async (condition, label) => {
  for (let i = 0; i < 150; i++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const wait = (expression, label) => until(() => evaluate(`Boolean(${expression})`), label)
const accountMenu = async () => {
  await evaluate(`document.querySelector('[aria-label="Open account menu"]').click()`)
  await wait(`document.querySelector('[role="menu"]')`, 'account menu')
}
const signOut = () =>
  evaluate(`(() => {
  const item = [...document.querySelectorAll('[role="menuitem"]')].find(el => el.textContent === 'Sign out of staff account');
  if (!item) throw new Error('Staff sign-out control is missing');
  item.click();
})()`)
try {
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__sessionRejections = []; window.addEventListener('unhandledrejection', event => window.__sessionRejections.push(String(event.reason?.message || event.reason)));`,
  })
  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/portal*', requestStage: 'Request' }],
  })
  await command('Page.navigate', { url: base })
  await wait(
    `document.querySelector('h1')?.textContent === 'A clear view. A focused day.'`,
    'staff workspace',
  )
  const loaded = navigations

  for (const failure of ['network', 'server', 'invalid-json']) {
    mode = failure
    await accountMenu()
    const before = requests.length
    await signOut()
    await until(() => requests.length > before, `${failure} request`)
    await wait(
      `window.__sessionRejections.length || (!document.querySelector('[role="menu"]') && document.querySelector('main [role="alert"]'))`,
      `${failure} handled`,
    )
    assert.deepEqual(
      await evaluate('window.__sessionRejections'),
      [],
      `${failure} must not emit unhandledRejection`,
    )
    assert.ok(
      await evaluate(
        `document.querySelector('main [role="alert"]')?.textContent.includes('sign-out')`,
      ),
      `${failure} shows recoverable feedback`,
    )
    assert.equal(navigations, loaded, `${failure} must not reload or claim successful sign-out`)
    assert.equal(requests.at(-1).action, 'logout')
  }
  console.log(
    'PASS network, HTTP and malformed-response logout failures are caught without reloads',
  )

  mode = 'hold'
  await accountMenu()
  const before = requests.length
  await signOut()
  await until(() => Boolean(held), 'pending sign-out')
  await wait(
    `document.querySelector('[role="menu"]').textContent.includes('Signing out…')`,
    'pending feedback',
  )
  assert.equal(requests.length, before + 1)
  await evaluate(`document.querySelector('[role="menuitem"][aria-disabled="true"]').click()`)
  assert.equal(requests.length, before + 1, 'pending sign-out cannot be submitted twice')
  authenticated = false
  await reply(held, 200, { ok: true })
  await wait(`document.getElementById('access-email')`, 'successful staff sign-out')
  assert.ok(navigations > loaded, 'verified success reloads the session')
  console.log('PASS pending state and verified staff sign-out')

  authenticated = true
  fixture.user.cms = true
  await command('Page.navigate', { url: base })
  await wait(
    `document.querySelector('h1')?.textContent === 'A clear view. A focused day.'`,
    'CMS-managed workspace',
  )
  await accountMenu()
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('[role="menuitem"]')].some(el => el.textContent === 'Sign out of staff account')`,
    ),
    false,
  )
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('[role="menuitem"]')].find(el => el.textContent === 'Manage administrator session')?.getAttribute('href')`,
    ),
    '/admin',
  )
  assert.deepEqual(await evaluate('window.__sessionRejections'), [])
  console.log('PASS CMS-managed sessions are not presented as staff-cookie sessions')
} finally {
  await fetch(`${debug}/json/close/${target.id}`).catch(() => {})
  socket.close()
}
