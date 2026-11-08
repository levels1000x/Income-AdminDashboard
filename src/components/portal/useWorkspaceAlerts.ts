import { useCallback, useEffect, useRef, useState } from 'react'
import {
  defaultAlertPreferences,
  callNotices,
  followUpNotices,
  isCurrentNotice,
  isAudibleNotice,
  leadNotice,
  type AlertPreferences,
  type AlertSnapshot,
  type WorkspaceNotice,
} from '@/lib/portal-notifications'
import { NotificationSound } from './notification-sound'

type Seen = Record<string, number>
const memory = new Map<string, Seen>()
const volatile = new Set<string>()
function readSeen(key: string): Seen {
  if (volatile.has(key)) return memory.get(key) || {}
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return memory.get(key) || {}
  }
}
function writeSeen(key: string, value: Seen) {
  memory.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
    volatile.delete(key)
  } catch {
    volatile.add(key)
    /* private mode: in-memory fallback */
  }
}
const snoozeKey = (notice: WorkspaceNotice) =>
  `snooze:${notice.kind === 'call' ? notice.key.slice(0, notice.key.lastIndexOf(':')) : notice.key}`
async function claim(key: string, notice: WorkspaceNotice, now: number, audio = false) {
  const update = () => {
    const value = Object.fromEntries(
      Object.entries(readSeen(key)).filter(
        ([, time]) => typeof time === 'number' && time > now - 7 * 86400000,
      ),
    )
    const eventKey = audio ? `sound:${notice.key}` : notice.key
    if (value[eventKey] || (value[snoozeKey(notice)] || 0) > now) return false
    value[eventKey] = now
    writeSeen(key, value)
    return true
  }
  if (navigator.locks?.request) {
    try {
      return await navigator.locks.request(key, { ifAvailable: true }, (lock) =>
        lock ? update() : false,
      )
    } catch {
      return update()
    }
  }
  return update()
}

export function useWorkspaceAlerts(userKey: string | null, workspaceEnabled: boolean) {
  const [owner, setOwner] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AlertSnapshot | null>(null)
  const [inbox, setInbox] = useState<WorkspaceNotice[]>([])
  const [toast, setToast] = useState<WorkspaceNotice | null>(null)
  const [soundReady, setSoundReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState<'loading' | 'connected' | 'paused'>('loading')
  const sound = useRef<NotificationSound | null>(null)
  sound.current ??= new NotificationSound()
  const latest = useRef<AlertSnapshot | null>(null)
  const storageKey = useRef('')
  const active = useRef<string | null>(null)
  const pollNow = useRef<() => Promise<void>>(async () => {})
  const request = useRef<AbortController | null>(null)
  const saveBusy = useRef(false)
  const preferenceVersion = useRef(0)
  const clockOffset = useRef(0)
  const openFromDesktop = useRef<(notice: WorkspaceNotice) => void>(() => {})
  const preferences = owner === userKey && snapshot ? snapshot.preferences : defaultAlertPreferences
  const globallyEnabled = useRef(workspaceEnabled)
  globallyEnabled.current = workspaceEnabled

  useEffect(() => {
    active.current = userKey
    setOwner(userKey)
    setSnapshot(null)
    setInbox([])
    setToast(null)
    setError('')
    latest.current = null
    setConnection('loading')
    if (!userKey) return
    const key = `income-alert-delivery:${userKey}`
    storageKey.current = key
    let cursor: string | undefined
    let baseline = 0
    let page = 1
    let upper: string | undefined
    let started = 0
    let running = false
    let burst = 0
    let cancelled = false
    const desktops = new Set<Notification>()
    const belongs = () => !cancelled && active.current === userKey

    const deliver = async (notices: WorkspaceNotice[], state: AlertSnapshot) => {
      if (!belongs()) return
      const now = Date.now() + clockOffset.current
      setInbox((current) => current.filter((item) => isCurrentNotice(item, state)))
      setToast((current) => (current && isCurrentNotice(current, state) ? current : null))
      if (!globallyEnabled.current || !state.workspaceEnabled) return
      const accepted: WorkspaceNotice[] = []
      let audible = false
      for (const notice of notices) {
        if (!belongs()) return
        if (await claim(key, notice, now)) accepted.push(notice)
        if (
          state.preferences.soundEnabled &&
          sound.current?.ready &&
          isAudibleNotice(notice, started, now) &&
          (await claim(key, notice, now, true))
        )
          audible = true
      }
      if (!belongs()) return
      if (audible && latest.current?.preferences.soundEnabled && globallyEnabled.current)
        sound.current?.play()
      setSoundReady(Boolean(sound.current?.ready))
      if (!accepted.length) return
      setInbox((current) =>
        [
          ...accepted.slice().reverse(),
          ...current.filter(
            (item) =>
              !accepted.some(
                (next) =>
                  next.key === item.key ||
                  (next.kind === 'call' && item.kind === 'call' && next.recordId === item.recordId),
              ),
          ),
        ].slice(0, 50),
      )
      // Old overdue tasks are visible in the inbox, but never ring as a login backlog.
      const fresh = accepted.filter((item) => isAudibleNotice(item, started, now))
      if (!fresh.length) return
      const priority = (item: WorkspaceNotice) =>
        item.kind === 'call' ? (item.key.endsWith(':0') ? 0 : 1) : item.kind === 'lead' ? 2 : 3
      const recent = [...fresh].sort((a, b) => priority(a) - priority(b))[0]
      setToast(
        fresh.length > 1 && fresh.every((item) => item.kind === 'lead')
          ? {
              ...recent,
              title: `${fresh.length} new inbound records`,
              detail: 'Open notifications to review the new leads and registrations.',
              grouped: true,
            }
          : recent,
      )
      if (
        state.preferences.desktopEnabled &&
        document.visibilityState !== 'visible' &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        try {
          const desktop = new Notification(`Income · ${recent.title}`, {
            body: 'Open Income to review the record.',
            tag: recent.key,
            silent: true,
          })
          desktops.add(desktop)
          desktop.onclick = () => {
            try {
              window.focus()
            } catch {
              /* Embedded windows can refuse focus. */
            }
            openFromDesktop.current(recent)
            desktop.close()
            desktops.delete(desktop)
          }
          setTimeout(() => {
            desktop.close()
            desktops.delete(desktop)
          }, 15000)
        } catch {
          /* Embedded/browser restrictions must not stop in-app alerts. */
        }
      }
    }
    const reminders = () => {
      const state = latest.current
      if (!state || !belongs()) return
      const now = Date.now() + clockOffset.current
      if (now - Date.parse(state.serverTime) > 90000) return
      const notices = [
        ...(state.preferences.callReminders
          ? callNotices(state.calls, state.preferences.advanceMinutes, now)
          : []),
        ...(state.preferences.followUpReminders ? followUpNotices(state.followUps, now) : []),
      ]
      void deliver(notices, state).catch(() => {})
    }
    const poll = async (continuation = false) => {
      if (running || cancelled || !navigator.onLine) {
        if (!navigator.onLine && belongs()) setConnection('paused')
        return
      }
      running = true
      if (!continuation) burst = 0
      const controller = new AbortController()
      const settingsVersion = preferenceVersion.current
      request.current = controller
      const timeout = window.setTimeout(() => controller.abort(), 15000)
      try {
        const query = new URLSearchParams()
        if (cursor) query.set('since', cursor)
        if (upper) query.set('until', upper)
        query.set('page', String(page))
        const response = await fetch(`/api/portal-alerts?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Alert update failed.')
        const state: AlertSnapshot = await response.json()
        if (
          !state ||
          !Number.isFinite(Date.parse(state.serverTime)) ||
          !Number.isFinite(Date.parse(state.until)) ||
          !state.preferences ||
          !Array.isArray(state.newLeads) ||
          !Array.isArray(state.calls) ||
          !Array.isArray(state.followUps)
        )
          throw new Error('Invalid alert response.')
        if (!belongs()) return
        if ((saveBusy.current || settingsVersion !== preferenceVersion.current) && latest.current)
          state.preferences = latest.current.preferences
        clockOffset.current = Date.parse(state.serverTime) - Date.now()
        if (!started) started = Date.parse(state.serverTime)
        if (!baseline) baseline = Date.parse(state.until)
        latest.current = state
        setSnapshot(state)
        setConnection('connected')
        if (cursor && state.preferences.leadAlerts) {
          await deliver(
            state.newLeads.map((lead) => leadNotice(lead, Date.now() + clockOffset.current)),
            state,
          )
        }
        if (state.nextPage) {
          page = state.nextPage
          upper = state.until
        } else {
          // Re-read a short overlap for writes that commit just after a poll.
          // Native-ID delivery keys prevent duplicate chimes; the baseline
          // still excludes records that existed before opening Income.
          cursor = new Date(Math.max(baseline, Date.parse(state.until) - 60000)).toISOString()
          page = 1
          upper = undefined
        }
        reminders()
      } catch {
        if (belongs()) setConnection('paused')
      } finally {
        running = false
        clearTimeout(timeout)
        if (request.current === controller) request.current = null
        if (upper && burst < 4 && belongs()) {
          burst++
          queueMicrotask(() => {
            void poll(true)
          })
        }
      }
    }
    pollNow.current = poll
    void poll()
    const pollTimer = window.setInterval(() => {
      void poll()
    }, 30000)
    const reminderTimer = window.setInterval(reminders, 15000)
    const resume = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelled = true
      request.current?.abort()
      clearInterval(pollTimer)
      clearInterval(reminderTimer)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
      sound.current?.close()
      desktops.forEach((desktop) => desktop.close())
      setSoundReady(false)
    }
  }, [userKey])

  const refresh = useCallback(() => pollNow.current(), [])
  const savePreferences = async (value: AlertPreferences) => {
    if (saveBusy.current || !userKey) return false
    saveBusy.current = true
    setSaving(true)
    setError('')
    const currentUser = userKey
    const previous = latest.current?.preferences
    preferenceVersion.current++
    if (latest.current) {
      latest.current = { ...latest.current, preferences: value }
      setSnapshot(latest.current)
    }
    try {
      const response = await fetch('/api/portal-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      const result = await response.json()
      if (!response.ok || !result.ok)
        throw new Error('Alert settings could not be saved. Please retry.')
      if (active.current !== currentUser) return false
      if (latest.current) {
        latest.current = { ...latest.current, preferences: value }
        setSnapshot(latest.current)
      }
      if (!value.leadAlerts || !value.callReminders || !value.followUpReminders) {
        setInbox((current) =>
          current.filter((item) =>
            item.kind === 'lead'
              ? value.leadAlerts
              : item.kind === 'call'
                ? value.callReminders
                : value.followUpReminders,
          ),
        )
        setToast((current) =>
          current &&
          (current.kind === 'lead'
            ? value.leadAlerts
            : current.kind === 'call'
              ? value.callReminders
              : value.followUpReminders)
            ? current
            : null,
        )
      }
      return true
    } catch {
      if (active.current === currentUser) {
        if (previous && latest.current) {
          latest.current = { ...latest.current, preferences: previous }
          setSnapshot(latest.current)
        }
        setError('Alert settings could not be saved. Check your connection and retry.')
      }
      return false
    } finally {
      preferenceVersion.current++
      saveBusy.current = false
      setSaving(false)
    }
  }
  const enableSound = async () => {
    setError('')
    const ready = await sound.current!.enable()
    setSoundReady(ready)
    if (!ready) {
      setError('Sound is blocked or unavailable in this browser. In-app alerts still work.')
      return false
    }
    sound.current!.play(true)
    if (!preferences.soundEnabled) return savePreferences({ ...preferences, soundEnabled: true })
    return true
  }
  const testSound = async () => {
    const ready = await sound.current!.enable()
    setSoundReady(ready)
    if (ready) sound.current!.play(true)
    else setError('Sound is unavailable in this browser. In-app reminders still work.')
  }
  const enableDesktop = async () => {
    try {
      if (typeof Notification === 'undefined' || !window.isSecureContext) throw new Error()
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error()
      await savePreferences({ ...preferences, desktopEnabled: true })
    } catch {
      setError(
        'Browser notifications are not available or were declined. In-app reminders still work; the Make iframe may restrict this permission.',
      )
    }
  }
  const dismiss = (notice: WorkspaceNotice) => {
    setInbox((current) => current.filter((item) => item.key !== notice.key))
    setToast((current) => (current?.key === notice.key ? null : current))
  }
  const snooze = async (notice: WorkspaceNotice) => {
    const key = storageKey.current
    const update = () => {
      const value = readSeen(key)
      delete value[notice.key]
      delete value[`sound:${notice.key}`]
      value[snoozeKey(notice)] = Date.now() + clockOffset.current + 5 * 60000
      writeSeen(key, value)
    }
    try {
      if (navigator.locks?.request) {
        try {
          await navigator.locks.request(key, update)
        } catch {
          update()
        }
      } else update()
      dismiss(notice)
    } catch {
      setError('This reminder could not be snoozed. Please retry.')
    }
  }
  return {
    preferences,
    loaded: owner === userKey && Boolean(snapshot),
    saving,
    error,
    connection,
    inbox: owner === userKey ? inbox : [],
    toast: owner === userKey ? toast : null,
    calls: owner === userKey ? snapshot?.calls || [] : [],
    soundReady,
    workspaceEnabled: workspaceEnabled && snapshot?.workspaceEnabled !== false,
    refresh,
    savePreferences,
    enableSound,
    testSound,
    enableDesktop,
    dismiss,
    snooze,
    closeToast: () => setToast(null),
    clearError: () => setError(''),
    onDesktopOpen: (callback: (notice: WorkspaceNotice) => void) => {
      openFromDesktop.current = callback
    },
  }
}
export type WorkspaceAlerts = ReturnType<typeof useWorkspaceAlerts>
