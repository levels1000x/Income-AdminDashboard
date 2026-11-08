import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

// Uses the existing app server and a separately launched headless Chromium.
const base = process.env.PORTAL_TEST_URL || 'http://localhost:3000'
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9222'
const target = await fetch(`${debug}/json/new?about:blank`, {
  method: 'PUT',
}).then((response) => response.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map()
const hydrationErrors = []
const exceptions = []
const authCalls = []
let authMode = 'hold'
let heldRequest
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id) {
    const handlers = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handlers?.reject(new Error(message.error.message))
    else handlers?.resolve(message.result)
  }
  if (message.method === 'Fetch.requestPaused') {
    authCalls.push(JSON.parse(message.params.request.postData))
    const requestId = message.params.requestId
    if (authMode === 'hold') heldRequest = requestId
    else if (authMode === 'network') {
      void command('Fetch.failRequest', { requestId, errorReason: 'Failed' })
    } else {
      void command('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({ ok: true })).toString('base64'),
      })
    }
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const detail = message.params.exceptionDetails
    exceptions.push(detail.exception?.description || detail.text)
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = message.params.args.map((arg) => arg.value || arg.description || '').join(' ')
    if (
      /hydration|server rendered HTML|didn't match|did not match|Minified React error #(418|423|425)/i.test(
        text,
      )
    )
      hydrationErrors.push(text)
  }
})
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
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
const waitFor = async (expression, label) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const fill = (id, value) =>
  evaluate(`(() => {
  const field = document.getElementById(${JSON.stringify(id)});
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
  field.dispatchEvent(new Event('input', { bubbles: true }));
})()`)
const submit = () => evaluate(`document.querySelector('form').requestSubmit()`)
const readyPassword = async () => {
  // Reset pages are prerendered: wait for an actual state change, not just SSR inputs.
  await waitFor(
    `(() => {
    const field = document.getElementById('access-password');
    if (field?.type === 'text') return true;
    document.querySelector('[aria-label="Show password"]')?.click();
    return false;
  })()`,
    'password form hydration',
  )
  await evaluate(`document.querySelector('[aria-label="Hide password"]').click()`)
  await waitFor(`document.getElementById('access-password').type === 'password'`, 'password masked')
}
try {
  await command('Page.enable')
  await command('Runtime.enable')
  for (const path of ['/', '/set-password', '/', '/set-password']) {
    const response = await fetch(`${base}${path}`)
    assert.equal(response.status, 200, `${path} serves successfully`)
    const html = await response.text()
    const styles = await evaluate(`(() => {
      const document = new DOMParser().parseFromString(${JSON.stringify(html)}, 'text/html');
      return {
        head: document.head.querySelectorAll('style[data-emotion]').length,
        root: document.querySelector('#root')?.querySelectorAll('style[data-emotion]').length ?? 0,
      };
    })()`)
    assert.ok(styles.head > 0, `${path}: SSR Emotion styles are flushed into the head`)
    assert.equal(styles.root, 0, `${path}: style tags do not displace hydrated content`)
    await command('Page.navigate', { url: `${base}${path}` })
    await waitFor(
      path === '/set-password'
        ? `document.querySelector('h1')?.textContent === 'Set your password'`
        : `Boolean(document.querySelector('input[autocomplete="email"]'))`,
      `${path} renders`,
    )
    await waitFor(
      `Boolean(document.querySelector('input[type="password"]'))`,
      `${path} interactive form`,
    )
    const input = await evaluate(`(() => {
      const field = document.querySelector('input[type="password"]');
      field.focus();
      return document.activeElement === field;
    })()`)
    assert.equal(input, true, `${path} form remains interactive`)
    for (const width of [1440, 320]) {
      await command('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 768,
      })
      const layout = await evaluate(`(() => {
        const section = document.querySelector('section[aria-labelledby="access-title"]');
        const form = section?.querySelector('form');
        const primary = form?.querySelector('button[type="submit"]');
        const secondary = section?.querySelector('a.MuiButton-text');
        return {
          fits: document.documentElement.scrollWidth <= innerWidth,
          compact: section?.getBoundingClientRect().width <= 384,
          flat: section && getComputedStyle(section).backgroundColor === 'rgba(0, 0, 0, 0)',
          restrainedHeading: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) <= 24,
          primary: Boolean(primary?.classList.contains('MuiButton-contained')),
          secondary: Boolean(secondary?.getAttribute('href') === ${JSON.stringify(path === '/set-password' ? '/' : '/admin')}),
          touchTargets: [...section.querySelectorAll('button, a.MuiButton-root')].every(el => el.getBoundingClientRect().height >= 44),
        };
      })()`)
      for (const [check, passed] of Object.entries(layout))
        assert.equal(passed, true, `${path} at ${width}px: ${check}`)
      if (path === '/') {
        await evaluate('document.fonts.ready')
        const image = await command('Page.captureScreenshot', { format: 'png' })
        await writeFile(`/tmp/income-login-${width}.png`, Buffer.from(image.data, 'base64'))
      }
    }
    // Allow hydration/recoverable errors to reach the browser console.
    await new Promise((resolve) => setTimeout(resolve, 500))
    assert.deepEqual(hydrationErrors, [], `${path}: no hydration warnings`)
    assert.deepEqual(exceptions, [], `${path}: no uncaught exceptions`)
    console.log(`PASS ${path}: head-only SSR styles, hydration and interactive form`)
  }
  // Intercept only test submissions: no credentials are sent to the real backend.
  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/portal-auth', requestStage: 'Request' }],
  })
  await command('Page.navigate', { url: base })
  await waitFor(`Boolean(document.getElementById('access-email'))`, 'login fields')
  assert.equal(
    await evaluate(`document.querySelector('label[for="access-email"]').textContent`),
    'Email address',
  )
  await submit()
  await waitFor(
    `document.getElementById('access-email').getAttribute('aria-invalid') === 'true'`,
    'required email validation',
  )
  assert.equal(await evaluate(`document.activeElement.id`), 'access-email')
  assert.equal(authCalls.length, 0, 'empty forms do not reach the server')
  await fill('access-email', 'invalid')
  await submit()
  await waitFor(
    `document.querySelector('form').textContent.includes('Enter a valid email address.')`,
    'email format guidance',
  )
  await fill('access-email', 'staff@example.test')
  await fill('access-password', 'short')
  await submit()
  await waitFor(
    `document.getElementById('access-password').getAttribute('aria-invalid') === 'true'`,
    'password length guidance',
  )
  assert.equal(authCalls.length, 0, 'invalid credentials do not reach the server')
  assert.equal(await evaluate(`document.activeElement.id`), 'access-password')
  await fill('access-password', 'test-password-123')
  await evaluate(`document.querySelector('[aria-label="Show password"]').click()`)
  assert.equal(await evaluate(`document.getElementById('access-password').type`), 'text')
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Hide password"]').getAttribute('aria-pressed')`,
    ),
    'true',
  )
  await evaluate(`document.querySelector('[aria-label="Hide password"]').click()`)
  assert.equal(
    await evaluate(`document.getElementById('access-password').value`),
    'test-password-123',
  )
  await evaluate(
    `document.getElementById('access-password').dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'A', modifierCapsLock: true }))`,
  )
  await waitFor(
    `document.querySelector('form').textContent.includes('Caps Lock is on.')`,
    'Caps Lock warning',
  )
  await evaluate(`document.getElementById('access-email').focus()`)
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', windowsVirtualKeyCode: 9 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', windowsVirtualKeyCode: 9 })
  assert.equal(
    await evaluate(`document.activeElement.id`),
    'access-password',
    'keyboard order moves from email to password',
  )
  console.log(
    'PASS persistent labels, inline validation, keyboard order, password visibility and Caps Lock guidance',
  )

  await submit()
  await waitFor(
    `document.querySelector('button[type="submit"]').textContent === 'Signing in…'`,
    'specific pending copy',
  )
  assert.ok(heldRequest)
  assert.equal(authCalls.length, 1)
  assert.equal(authCalls[0].action, 'login')
  assert.equal(authCalls[0].email, 'staff@example.test')
  assert.equal(
    await evaluate(
      `document.getElementById('access-email').disabled && document.getElementById('access-password').disabled`,
    ),
    true,
  )
  await submit()
  assert.equal(authCalls.length, 1, 'repeat submissions are ignored while pending')
  await command('Fetch.fulfillRequest', {
    requestId: heldRequest,
    responseCode: 401,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(
      JSON.stringify({ ok: false, error: 'internal-diagnostic-not-for-display' }),
    ).toString('base64'),
  })
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('Check your email and password')`,
    'actionable authentication error',
  )
  assert.equal(
    await evaluate(`document.activeElement.getAttribute('role')`),
    'alert',
    'errors receive focus',
  )
  assert.equal(
    await evaluate(`document.querySelector('main').textContent.includes('internal-diagnostic')`),
    false,
  )
  assert.equal(
    await evaluate(`document.getElementById('access-password').value`),
    'test-password-123',
    'failed sign-in preserves input',
  )
  authMode = 'network'
  await fill('access-password', 'another-test-password')
  await submit()
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('Check your connection')`,
    'distinct network recovery',
  )
  console.log(
    'PASS pending state, duplicate-submit prevention, credential retention, safe server errors and network recovery',
  )

  await command('Page.navigate', { url: `${base}/set-password` })
  await waitFor(
    `document.querySelector('h1')?.textContent === 'Set your password' && !document.getElementById('access-email') && document.getElementById('access-password')?.value === ''`,
    'password setup',
  )
  await readyPassword()
  await fill('access-password', 'test-password-123')
  await submit()
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('invitation link is incomplete')`,
    'missing invitation guidance',
  )
  assert.equal(authCalls.length, 2, 'incomplete invitations do not reach the server')
  authMode = 'success'
  await command('Page.navigate', { url: `${base}/set-password?token=test-invitation` })
  await waitFor(
    `document.querySelector('h1')?.textContent === 'Set your password' && !document.querySelector('[role="alert"]') && document.getElementById('access-password')?.value === ''`,
    'valid invitation view',
  )
  await readyPassword()
  await fill('access-password', 'test-password-123')
  await submit()
  await waitFor(
    `document.querySelector('h1')?.textContent === 'Password set'`,
    'clear invitation completion',
  )
  assert.equal(await evaluate(`document.activeElement.id`), 'access-title')
  assert.equal(
    await evaluate(`document.querySelector('input') === null`),
    true,
    'completed setup removes password fields',
  )
  assert.equal(
    await evaluate(`document.querySelector('a.MuiButton-contained').getAttribute('href')`),
    '/',
  )
  assert.equal(authCalls.at(-1).action, 'accept')
  assert.equal(authCalls.at(-1).token, 'test-invitation')
  assert.deepEqual(hydrationErrors, [])
  assert.deepEqual(exceptions, [])
  console.log('PASS missing-link recovery and password-setup completion without backend mutations')
} catch (error) {
  console.error(
    await evaluate(`JSON.stringify({
    heading: document.querySelector('h1')?.textContent,
    feedback: document.querySelector('[role="alert"]')?.textContent,
    formCopy: document.querySelector('form')?.textContent,
    focus: document.activeElement?.id
  })`),
  )
  throw error
} finally {
  await fetch(`${debug}/json/close/${target.id}`).catch(() => {})
  socket.close()
}
