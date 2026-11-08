import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  IconButton,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Command,
  CreditCard,
  LayoutDashboard,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Video,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  PortalContext,
  type Activity,
  type PortalData,
  type Preferences,
  type Route,
  type CalendarViewState,
  type WorkingHours,
} from './context'
import {
  initialFilters,
  needsAttention,
  type Section,
  type LeadFilters,
  type Lead,
  type Appointment,
  type Payment,
  setOwners,
  demoToday,
} from './model'
import { Heading, RowArrow } from './ui'
import { Overview, Leads, LeadProfile } from './LeadWorkspace'
import { AccessScreen } from './AccessScreen'
import { WebinarWorkspace } from './WebinarWorkspace'
import './workspace.css'
import {
  ConnectionNotice,
  IncomeWordmark,
  PortalErrorBoundary,
  WorkspaceLoading,
} from './fallbacks'
import { useWorkspaceAlerts } from './useWorkspaceAlerts'
import { WorkReminders, WorkspaceAlertToast } from './WorkspaceNotifications'
import type { WorkspaceNotice } from '@/lib/portal-notifications'

const CalendarWorkspace = lazy(() =>
  import('./CalendarWorkspace').then((module) => ({
    default: module.CalendarWorkspace,
  })),
)
const AppointmentProfile = lazy(() =>
  import('./CalendarWorkspace').then((module) => ({
    default: module.AppointmentProfile,
  })),
)
const Payments = lazy(() => import('./Operations').then((module) => ({ default: module.Payments })))
const Settings = lazy(() => import('./Operations').then((module) => ({ default: module.Settings })))

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'webinars', label: 'Webinars', icon: Video },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const
function readRoute(): Route {
  const [section, encodedId] = window.location.hash.replace(/^#\/?/, '').split('/')
  const valid = navigation.some((item) => item.id === section)
  let id: string | undefined
  try {
    id = encodedId ? decodeURIComponent(encodedId) : undefined
  } catch {
    id = undefined
  }
  return { section: valid ? (section as Section) : 'overview', id }
}
export default function IncomePortal() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [leads, setLeads] = useState<Lead[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [filters, setFilterState] = useState(initialFilters)
  const [leadPage, setLeadPage] = useState(1)
  const [calendar, setCalendar] = useState<CalendarViewState>({
    view: 'Schedule',
    anchor: demoToday,
    timezone: '',
    owner: 'Everyone',
    status: 'All statuses',
    query: '',
  })
  const [preferences, setPreferences] = useState<Preferences>({
    workspace: 'Income',
    timezone: 'America/New_York',
    notifications: true,
    session: '',
    capacity: '',
  })
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHours>>({})
  const [activities, setActivities] = useState<Activity[]>([])
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)
  const alerts = useWorkspaceAlerts(
    data && !signedOut ? `${data.user.cms ? 'admins' : 'users'}:${data.user.id}` : null,
    preferences.notifications,
  )
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/portal', { cache: 'no-store' })
      if (response.status === 401) {
        setSignedOut(true)
        return false
      }
      if (!response.ok) throw new Error('Workspace could not load. Try again.')
      const result: PortalData = await response.json()
      setData(result)
      setSignedOut(false)
      setLoadError('')
      setLeads(result.leads.filter((lead) => !lead.archived))
      setAppointments(result.appointments)
      setPayments(result.payments)
      setPreferences({ ...result.preferences, session: '', capacity: '' })
      setOwners(result.team.map((member) => member.name))
      setWorkingHours(
        Object.fromEntries(
          result.team.map((member) => [
            member.name,
            { start: member.availableFrom, end: member.availableUntil },
          ]),
        ),
      )
      setActivities(result.activities)
      return true
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load workspace.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void reload()
  }, [reload])
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const signOutPending = useRef(false)
  const [message, setMessage] = useState('')
  const unsaved = useRef(false)
  const currentHash = useRef(window.location.hash)
  const setUnsavedChanges = useCallback((dirty: boolean) => {
    unsaved.current = dirty
  }, [])
  const attention = leads.filter(needsAttention)
  useEffect(() => {
    const hashChange = () => {
      if (window.location.hash === '#ip-main') {
        window.history.replaceState(null, '', currentHash.current || '#/overview')
        document.getElementById('ip-main')?.focus()
        return
      }
      if (unsaved.current && !window.confirm('Discard unsaved changes and leave this page?')) {
        window.history.replaceState(null, '', currentHash.current || '#/overview')
        return
      }
      unsaved.current = false
      currentHash.current = window.location.hash
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('hashchange', hashChange)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('hashchange', hashChange)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const navigate = (section: Section, id?: string) => {
    if (route.section === section && route.id === id) {
      setMobileOpen(false)
      setSearchOpen(false)
      setNotificationsOpen(false)
      return true
    }
    if (unsaved.current && !window.confirm('Discard unsaved changes and leave this page?'))
      return false
    unsaved.current = false
    window.location.hash = `/${section}${id ? `/${encodeURIComponent(id)}` : ''}`
    currentHash.current = window.location.hash
    setRoute({ section, id })
    setMobileOpen(false)
    setSearchOpen(false)
    setNotificationsOpen(false)
    window.scrollTo({ top: 0 })
    return true
  }
  const setFilters = (patch: Partial<LeadFilters>) => {
    setFilterState((current) => ({ ...current, ...patch }))
    setLeadPage(1)
  }
  const openLeads = (patch: Partial<LeadFilters> = {}) => {
    if (navigate('leads')) {
      setFilterState({ ...initialFilters, ...patch })
      setLeadPage(1)
    }
  }
  const run = async (action: string, values: unknown, id?: string, updatedAt?: string) => {
    if (busy.current) return false
    setLoadError('')
    busy.current = true
    setPending(true)
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: values, id, updatedAt }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to save changes.')
      unsaved.current = false
      const refreshed = await reload()
      void alerts.refresh()
      if (refreshed) setMessage(result.message)
      else
        setLoadError(
          'Changes saved, but the latest data could not be loaded. Refresh the workspace before making more changes.',
        )
      return true
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to save.')
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  const signOutStaff = async () => {
    if (signOutPending.current) return
    if (unsaved.current && !window.confirm('Discard unsaved changes and sign out?')) return
    signOutPending.current = true
    setSigningOut(true)
    setLoadError('')
    try {
      const response = await fetch('/api/portal-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.ok !== true) throw new Error('Sign-out was not confirmed.')
      unsaved.current = false
      window.location.reload()
    } catch {
      setLoadError('Couldn’t confirm sign-out. Check your connection and try again.')
      setProfileAnchor(null)
    } finally {
      signOutPending.current = false
      setSigningOut(false)
    }
  }
  const openNotice = async (notice: WorkspaceNotice) => {
    if (busy.current) return
    if (unsaved.current && !window.confirm('Discard unsaved changes and open this reminder?'))
      return
    if (await reload()) {
      unsaved.current = false
      navigate(notice.section, notice.recordId)
      alerts.dismiss(notice)
      alerts.closeToast()
      setNotificationsOpen(false)
    }
  }
  useEffect(() => {
    alerts.onDesktopOpen((notice) => {
      void openNotice(notice)
    })
  })
  const searchQuery = search.trim().toLowerCase()
  const searchLeads = searchQuery
    ? leads.filter((l) => `${l.name} ${l.company} ${l.email}`.toLowerCase().includes(searchQuery))
    : leads.slice(0, 4)
  const Sidebar = (
    <Box className="ip-sidebar-inner">
      <Box className="ip-brand">
        <Box className="ip-brand-artwork">
          <IncomeWordmark className="ip-wordmark" />
        </Box>
        <Typography className="ip-brand-admin">ADMIN</Typography>
        <IconButton
          className="ip-mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={18} />
        </IconButton>
      </Box>
      <ButtonBase
        className="ip-sidebar-search"
        onClick={() => setSearchOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={16} />
        <Typography variant="body2">Search workspace</Typography>
        <Box className="ip-keycap">⌘ K</Box>
      </ButtonBase>
      <Box className="ip-navigation-label">WORKSPACE</Box>
      <Box component="nav" aria-label="Primary navigation" className="ip-nav">
        {navigation.map((item) => (
          <Tooltip
            key={item.id}
            title={
              collapsed
                ? item.id === 'leads'
                  ? `${item.label}: ${leads.length} total, ${attention.length} need attention`
                  : item.label
                : ''
            }
            placement="right"
          >
            <Button
              className={`ip-nav-item ${route.section === item.id ? 'is-active' : ''}`}
              aria-current={route.section === item.id ? 'page' : undefined}
              data-has-attention={item.id === 'leads' && attention.length > 0}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={16} />
              <Typography variant="body2">{item.label}</Typography>
              {item.id === 'leads' && (
                <Box component="span" className="ip-nav-count">
                  {leads.length}
                </Box>
              )}
            </Button>
          </Tooltip>
        ))}
      </Box>
      <Box className="ip-saved-views">
        <Box className="ip-navigation-label">QUICK VIEWS</Box>
        <Button
          className="ip-quick-view"
          data-tone="attention"
          data-empty={attention.length === 0}
          onClick={() => openLeads({ queue: 'attention' })}
        >
          <CircleAlert size={16} />
          <Typography className="ip-quick-label">Needs attention</Typography>
          <Box component="span" className="ip-quick-count">
            {attention.length}
          </Box>
        </Button>
        <Button
          className="ip-quick-view"
          data-tone="source"
          onClick={() => openLeads({ source: 'Webinar' })}
        >
          <Video size={16} />
          <Typography className="ip-quick-label">Webinar follow-up</Typography>
          <Box component="span" className="ip-quick-count">
            {leads.filter((l) => l.source === 'Webinar').length}
          </Box>
        </Button>
        <Button className="ip-quick-view" onClick={() => openLeads({ queue: 'unassigned' })}>
          <Users size={16} />
          <Typography className="ip-quick-label">Unassigned leads</Typography>
          <Box component="span" className="ip-quick-count">
            {leads.filter((l) => l.owner === 'Unassigned').length}
          </Box>
        </Button>
      </Box>
      <Box className="ip-sidebar-bottom">
        <Box className="ip-preview-card">
          <Box className="ip-inline">
            <ShieldCheck size={16} />
            <Typography className="ip-name">Your workspace, simplified.</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            A focused view of your pipeline, people, and next steps.
          </Typography>
          <Button onClick={() => setHelpOpen(true)} endIcon={<ArrowUpRight size={14} />}>
            Workspace status
          </Button>
        </Box>
        <ButtonBase
          className="ip-profile"
          onClick={(event) => setProfileAnchor(event.currentTarget)}
          aria-label="Open account menu"
        >
          <Box className="ip-profile-avatar">
            {data?.user.name?.slice(0, 2).toUpperCase() || 'IN'}
          </Box>
          <Box className="ip-profile-label">
            <Typography className="ip-name">{data?.user.name || 'Administrator'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {data?.user.canManage ? 'Administrator' : 'Staff member'}
            </Typography>
          </Box>
          <ChevronDown size={14} />
        </ButtonBase>
      </Box>
    </Box>
  )
  if (loading)
    return (
      <Box className="income-workspace p-8">
        <WorkspaceLoading />
      </Box>
    )
  if (signedOut)
    return (
      <AccessScreen
        onSuccess={() => {
          void reload()
        }}
      />
    )
  if (!data)
    return (
      <Box className="income-workspace p-8">
        <Alert severity="error">{loadError || 'Unable to load workspace.'}</Alert>
        <Button
          onClick={() => {
            void reload()
          }}
        >
          Retry
        </Button>
      </Box>
    )
  return (
    <PortalContext.Provider
      value={{
        route,
        navigate,
        leads,
        appointments,
        payments,
        filters,
        setFilters,
        openLeads,
        preferences,
        activities,
        notify: setMessage,
        setUnsavedChanges,
        leadPage,
        setLeadPage,
        calendar,
        updateCalendar: (patch) => setCalendar((current) => ({ ...current, ...patch })),
        workingHours,
        data,
        run,
        reload,
        pending,
        error: loadError,
        alerts,
        updateWorkingHours: async (owner, hours) => {
          const member = data?.team.find((member) => member.name === owner)
          return member
            ? run('saveHours', { availableFrom: hours.start, availableUntil: hours.end }, member.id)
            : false
        },
        updateLead: async (lead) => {
          const {
            name,
            email,
            phone,
            company,
            service,
            owner,
            sales,
            nextAction,
            notes,
            registrationStatus,
            attendance,
            followUpStatus,
            taskCompleted,
            linkedApplication,
          } = lead
          return run(
            'saveLead',
            {
              name,
              email,
              phone,
              company,
              service,
              owner,
              sales,
              nextAction,
              notes,
              registrationStatus,
              attendance,
              followUpStatus,
              taskCompleted,
              linkedApplication: linkedApplication || null,
              followUp: lead.followUp
                ? new Date(
                    lead.followUp.endsWith('Z') ? lead.followUp : `${lead.followUp}Z`,
                  ).toISOString()
                : '',
            },
            lead.documentId,
            lead.updatedAt,
          )
        },
        updateAppointment: async (call) =>
          run(
            'saveAppointment',
            {
              lead: data.leads.find((lead) => lead.id === call.leadId)?.documentId,
              title: call.title,
              start: call.start,
              minutes: call.minutes,
              owner: call.owner,
              status: call.status,
              outcome: call.outcome,
              meetingURL: call.meetingURL || '',
              cancellationReason: call.cancellationReason || '',
            },
            call.documentId,
            call.updatedAt,
          ),
        updatePayment: async (payment) =>
          run(
            'savePayment',
            { status: payment.status, reviewNotes: payment.reviewNotes || '' },
            payment.documentId,
            payment.updatedAt,
          ),
        updatePreferences: (updated) =>
          run('savePreferences', {
            workspace: updated.workspace,
            timezone: updated.timezone,
            notifications: updated.notifications,
          }),
      }}
    >
      <Box className={`income-workspace ${collapsed ? 'is-collapsed' : ''}`}>
        <Button className="ip-skip-link" href="#ip-main">
          Skip to main content
        </Button>
        <Box component="aside" className="ip-sidebar" aria-label="Workspace sidebar">
          {Sidebar}
          <Tooltip title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            <IconButton
              className="ip-collapse"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </IconButton>
          </Tooltip>
        </Box>
        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} className="ip-mobile-drawer">
          {Sidebar}
        </Drawer>
        <Box className="ip-main-shell">
          <Box component="header" className="ip-topbar">
            <Box className="ip-inline ip-breadcrumbs">
              <IconButton
                className="ip-mobile-menu"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <MenuIcon size={19} />
              </IconButton>
              <Typography
                variant="body2"
                color="text.secondary"
                className="ip-workspace-label"
                noWrap
              >
                {preferences.workspace}
              </Typography>
              <ChevronRight size={13} className="ip-muted" />
              <Typography variant="body2" className="ip-breadcrumb-section">
                {navigation.find((item) => item.id === route.section)?.label}
              </Typography>
              {route.id && (
                <>
                  <ChevronRight size={13} className="ip-muted ip-breadcrumb-detail" />
                  <Typography variant="body2" className="ip-muted ip-breadcrumb-detail">
                    Details
                  </Typography>
                </>
              )}
            </Box>
            <Box className="ip-topbar-actions">
              <Box className="ip-preview-label">
                <Box className="ip-view-dot" />
                Connected workspace
              </Box>
              <Tooltip title="Search (Ctrl / Cmd + K)">
                <IconButton aria-label="Search" onClick={() => setSearchOpen(true)}>
                  <Search size={17} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Work reminders">
                <IconButton
                  aria-label="Open work reminders"
                  onClick={() => setNotificationsOpen(true)}
                  className="ip-notification-button"
                >
                  <Bell size={17} />
                  {(alerts.inbox.length > 0 ||
                    (preferences.notifications && attention.length > 0)) && (
                    <Box className="ip-notification-indicator" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip
                title={
                  alerts.soundReady && alerts.preferences.soundEnabled
                    ? 'Mute alert sound'
                    : 'Enable notification sound'
                }
              >
                <IconButton
                  aria-label={
                    alerts.soundReady && alerts.preferences.soundEnabled
                      ? 'Mute alert sound'
                      : 'Enable notification sound'
                  }
                  disabled={!alerts.loaded}
                  onClick={() => {
                    if (alerts.soundReady && alerts.preferences.soundEnabled)
                      void alerts.savePreferences({ ...alerts.preferences, soundEnabled: false })
                    else void alerts.enableSound()
                  }}
                >
                  {alerts.soundReady && alerts.preferences.soundEnabled ? (
                    <Volume2 size={17} />
                  ) : (
                    <VolumeX size={17} />
                  )}
                </IconButton>
              </Tooltip>
              <Box className="ip-topbar-separator" />
              <Tooltip title="Workspace status">
                <IconButton aria-label="Workspace status" onClick={() => setHelpOpen(true)}>
                  <CircleHelp size={17} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box component="main" id="ip-main" tabIndex={-1} className="ip-main-content">
            <ConnectionNotice />
            {alerts.error && (
              <Alert severity="warning" onClose={alerts.clearError} className="!mb-4">
                {alerts.error}
              </Alert>
            )}
            {loadError && (
              <Alert severity="error" onClose={() => setLoadError('')} className="!mb-4">
                {loadError}
              </Alert>
            )}
            {pending && (
              <Typography role="status" variant="caption">
                Saving changes…
              </Typography>
            )}
            <PortalErrorBoundary
              key={`${route.section}/${route.id || ''}`}
              scope="page"
              onOverview={route.section === 'overview' ? undefined : () => navigate('overview')}
            >
              <Suspense fallback={<WorkspaceLoading />}>
                {route.section === 'overview' && <Overview />}
                {route.section === 'leads' &&
                  (route.id ? <LeadProfile key={route.id} /> : <Leads />)}
                {route.section === 'calendar' &&
                  (route.id ? <AppointmentProfile key={route.id} /> : <CalendarWorkspace />)}
                {route.section === 'webinars' && <WebinarWorkspace />}
                {route.section === 'payments' && <Payments />}
                {route.section === 'settings' && <Settings />}
              </Suspense>
            </PortalErrorBoundary>
            <Box component="footer" className="ip-footer">
              <Box className="ip-footer-brand">
                <IncomeWordmark />
                <Typography variant="caption">Administration</Typography>
              </Box>
              <Typography variant="caption">Persistent records · Changes are audited</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            navigate('settings')
            setProfileAnchor(null)
          }}
        >
          Workspace preferences
        </MenuItem>
        <MenuItem
          onClick={() => {
            setHelpOpen(true)
            setProfileAnchor(null)
          }}
        >
          Workspace status
        </MenuItem>
        {data.user.cms ? (
          <MenuItem
            component="a"
            href="/admin"
            onClick={(event) => {
              if (
                unsaved.current &&
                !window.confirm('Discard unsaved changes and manage administrator access?')
              )
                event.preventDefault()
            }}
          >
            Manage administrator session
          </MenuItem>
        ) : (
          <MenuItem disabled={pending || signingOut} onClick={signOutStaff}>
            {signingOut ? 'Signing out…' : 'Sign out of staff account'}
          </MenuItem>
        )}
      </Menu>
      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="workspace-search-title"
      >
        <DialogTitle id="workspace-search-title">Search workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            placeholder="Search leads, companies, or workspace…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': 'Search workspace records' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box className="ip-command-results">
            <Typography className="ip-eyebrow">PAGES</Typography>
            {navigation
              .filter((n) => !searchQuery || n.label.toLowerCase().includes(searchQuery))
              .map((item) => (
                <ButtonBase
                  className="ip-command-row"
                  onClick={() => navigate(item.id)}
                  key={item.id}
                >
                  <item.icon size={16} />
                  <Typography variant="body2">{item.label}</Typography>
                  <RowArrow />
                </ButtonBase>
              ))}
            <Typography className="ip-eyebrow">LEADS</Typography>
            {searchLeads.map((lead) => (
              <ButtonBase
                className="ip-command-row"
                onClick={() => navigate('leads', lead.id)}
                key={lead.id}
              >
                <Users size={16} />
                <Box>
                  <Typography variant="body2">{lead.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lead.source}
                  </Typography>
                </Box>
                <RowArrow />
              </ButtonBase>
            ))}
            {searchLeads.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No matching leads.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <WorkReminders
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onOpen={(notice) => {
          void openNotice(notice)
        }}
      />
      <WorkspaceAlertToast
        onShowInbox={() => setNotificationsOpen(true)}
        onOpen={(notice) => {
          void openNotice(notice)
        }}
      />
      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="preview-info-title"
      >
        <DialogTitle id="preview-info-title">Connected administration</DialogTitle>
        <DialogContent>
          <Box className="ip-dialog-form">
            <Typography>
              Records are stored in Payload. Leads retain their original source identity. Changes
              are recorded in the audit log.
            </Typography>
            <Alert severity={data?.emailConfigured ? 'success' : 'warning'}>
              {data?.emailConfigured
                ? 'Email provider connected. Review delivery activity for send results.'
                : 'Email is not configured. Email invitations and email reminders are disabled; in-app alerts work independently.'}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Webinar host controls open your configured provider console. Financial review updates
              records; it does not move funds.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setHelpOpen(false)}>
            Understood
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        key={message}
        open={Boolean(message)}
        autoHideDuration={4500}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setMessage('')
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setMessage('')}>
          {message}
        </Alert>
      </Snackbar>
    </PortalContext.Provider>
  )
}
