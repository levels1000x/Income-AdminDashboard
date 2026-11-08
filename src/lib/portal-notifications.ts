export const defaultAlertPreferences = {
  leadAlerts: true,
  soundEnabled: true,
  callReminders: true,
  advanceMinutes: 10,
  followUpReminders: true,
  desktopEnabled: false,
}
export type AlertPreferences = typeof defaultAlertPreferences
export type AlertLead = {
  id: string
  documentId: string
  name: string
  source: string
  createdAt: string
}
export type AlertCall = {
  id: string
  documentId: string
  title: string
  start: string
  owner: string
  status: string
}
export type AlertFollowUp = {
  id: string
  documentId: string
  name: string
  followUp: string
  nextAction: string
}
export type WorkspaceNotice = {
  key: string
  kind: 'lead' | 'call' | 'follow-up'
  title: string
  detail: string
  section: 'leads' | 'calendar'
  recordId: string
  dueAt: number
  createdAt: number
  grouped?: boolean
}
export type AlertSnapshot = {
  preferences: AlertPreferences
  workspaceEnabled: boolean
  serverTime: string
  until: string
  nextPage: number | null
  newLeads: AlertLead[]
  calls: AlertCall[]
  followUps: AlertFollowUp[]
}
export function leadNotice(lead: AlertLead, now: number): WorkspaceNotice {
  return {
    key: `lead:${lead.documentId}`,
    kind: 'lead',
    title: lead.source === 'Webinar' ? 'New webinar registration' : 'New lead received',
    detail: `${lead.name} · ${lead.source}`,
    section: 'leads',
    recordId: lead.id,
    dueAt: now,
    createdAt: now,
  }
}
export function callNotices(calls: AlertCall[], minutes: number, now: number): WorkspaceNotice[] {
  return calls.flatMap((call) => {
    if (call.status !== 'Scheduled') return []
    const starts = Date.parse(call.start)
    if (!Number.isFinite(starts) || starts < now - 2 * 60000) return []
    const offset = starts > now ? minutes : 0
    const dueAt = starts - offset * 60000
    if (dueAt > now) return []
    const remaining = Math.max(1, Math.ceil((starts - now) / 60000))
    return [
      {
        key: `call:${call.documentId}:${call.start}:${offset}`,
        kind: 'call' as const,
        title:
          starts > now
            ? `Call in ${remaining} minute${remaining === 1 ? '' : 's'}`
            : 'Call starting now',
        detail: `${call.title} · ${call.owner}`,
        section: 'calendar' as const,
        recordId: call.id,
        dueAt,
        createdAt: now,
      },
    ]
  })
}
export function followUpNotices(rows: AlertFollowUp[], now: number): WorkspaceNotice[] {
  return rows
    .filter((row) => Number.isFinite(Date.parse(row.followUp)) && Date.parse(row.followUp) <= now)
    .map((row) => ({
      key: `follow-up:${row.documentId}:${row.followUp}`,
      kind: 'follow-up',
      title: 'Follow-up due',
      detail: `${row.name} · ${row.nextAction || 'Review the next action'}`,
      section: 'leads',
      recordId: row.id,
      dueAt: Date.parse(row.followUp),
      createdAt: now,
    }))
}
export function isCurrentNotice(notice: WorkspaceNotice, snapshot: AlertSnapshot) {
  if (notice.kind === 'lead') return true
  if (notice.kind === 'call')
    return snapshot.calls.some(
      (call) =>
        call.id === notice.recordId &&
        call.status === 'Scheduled' &&
        notice.key.startsWith(`call:${call.documentId}:${call.start}:`),
    )
  return snapshot.followUps.some(
    (row) => notice.key === `follow-up:${row.documentId}:${row.followUp}`,
  )
}
export function isAudibleNotice(notice: WorkspaceNotice, sessionStarted: number, now: number) {
  return (
    notice.kind !== 'follow-up' ||
    (notice.dueAt >= sessionStarted && now - notice.dueAt <= 5 * 60000)
  )
}
