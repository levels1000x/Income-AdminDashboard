import { createContext, useContext, useEffect } from 'react'
import type { Appointment, Lead, LeadFilters, Payment, Section } from './model'
import type { WorkspaceAlerts } from './useWorkspaceAlerts'
export type Route = {
  section: Section
  id?: string
}
export type Activity = {
  id: string
  title: string
  detail: string
  actor?: string
  createdAt?: string
  recordId?: string
}
export type Preferences = {
  workspace: string
  timezone: string
  notifications: boolean
  session: string
  capacity: string
}
export type CalendarViewState = {
  view: string
  anchor: string
  timezone: string
  owner: string
  status: string
  query: string
}
export type WorkingHours = {
  start: string
  end: string
}
export type PortalContextValue = {
  alerts: WorkspaceAlerts
  data: PortalData | null
  run: (action: string, data: unknown, id?: string, updatedAt?: string) => Promise<boolean>
  reload: () => Promise<boolean>
  pending: boolean
  error: string
  leads: Lead[]
  appointments: Appointment[]
  payments: Payment[]
  filters: LeadFilters
  setFilters: (patch: Partial<LeadFilters>) => void
  route: Route
  navigate: (section: Section, id?: string) => void
  openLeads: (patch?: Partial<LeadFilters>) => void
  updateLead: (lead: Lead) => Promise<boolean>
  updateAppointment: (appointment: Appointment) => Promise<boolean>
  updatePayment: (payment: Payment) => Promise<boolean>
  preferences: Preferences
  updatePreferences: (preferences: Preferences) => Promise<boolean>
  activities: Activity[]
  notify: (message: string) => void
  setUnsavedChanges: (dirty: boolean) => void
  leadPage: number
  setLeadPage: (page: number) => void
  calendar: CalendarViewState
  updateCalendar: (patch: Partial<CalendarViewState>) => void
  workingHours: Record<string, WorkingHours>
  updateWorkingHours: (owner: string, hours: WorkingHours) => Promise<boolean>
}
export type Webinar = {
  id: string
  updatedAt: string
  title: string
  startsAt: string
  timezone: string
  host: string
  duration: number
  capacity: number
  status: string
  registrationOpen: boolean
  waitlistEnabled: boolean
  joinURL?: string
  hostURL?: string
  replayURL?: string
  replayPublished: boolean
  description?: string
  cancellationReason?: string
}
export type PortalData = {
  user: { id: string; name: string; email: string; canManage: boolean; cms: boolean }
  leads: Lead[]
  appointments: Appointment[]
  payments: Payment[]
  webinars: Webinar[]
  preferences: Preferences
  activities: Activity[]
  team: Array<{
    id: string
    name: string
    role: string
    availableFrom: string
    availableUntil: string
  }>
  users: Array<{
    id: string
    name: string
    email: string
    role: string
    status: string
    updatedAt: string
  }>
  messages: Array<{
    id: string
    recipient: string
    subject: string
    status: string
    createdAt: string
  }>
  emailConfigured: boolean
}
export const PortalContext = createContext<PortalContextValue | null>(null)
export function usePortal() {
  const context = useContext(PortalContext)
  if (!context) throw new Error('Portal context is unavailable.')
  return context
}
export function useUnsavedChanges(dirty: boolean) {
  const { setUnsavedChanges } = usePortal()
  useEffect(() => {
    setUnsavedChanges(dirty)
    return () => setUnsavedChanges(false)
  }, [dirty, setUnsavedChanges])
}
