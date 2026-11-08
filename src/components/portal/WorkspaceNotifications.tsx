import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { Bell, Volume2, X } from 'lucide-react'
import { usePortal } from './context'
import type { WorkspaceNotice } from '@/lib/portal-notifications'
import { SectionHeader } from './ui'
import { needsAttention } from './model'

export function AlertSettings() {
  const { alerts } = usePortal()
  const { preferences, loaded, saving } = alerts
  const toggle = (
    key: 'leadAlerts' | 'soundEnabled' | 'callReminders' | 'followUpReminders',
    checked: boolean,
  ) => {
    void alerts.savePreferences({ ...preferences, [key]: checked })
  }
  return (
    <Stack spacing={2.5}>
      <Typography variant="h2">Your alerts</Typography>
      <Typography variant="body2" color="text.secondary">
        Personal settings are saved to your account. Sounds need permission from a click in each
        browser session.
      </Typography>
      {!alerts.workspaceEnabled && (
        <Alert severity="warning">
          Workspace reminders are paused. An administrator can enable them in General settings.
        </Alert>
      )}
      {alerts.error && <Alert severity="warning">{alerts.error}</Alert>}
      <FormControlLabel
        label="New lead and webinar registration alerts"
        control={
          <Switch
            checked={preferences.leadAlerts}
            disabled={!loaded || saving}
            onChange={(e) => toggle('leadAlerts', e.target.checked)}
          />
        }
      />
      <FormControlLabel
        label="Play a ding for new alerts"
        control={
          <Switch
            checked={preferences.soundEnabled}
            disabled={!loaded || saving}
            onChange={(e) => toggle('soundEnabled', e.target.checked)}
          />
        }
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {preferences.soundEnabled && !alerts.soundReady && (
          <Button
            type="button"
            variant="outlined"
            startIcon={<Volume2 size={16} />}
            disabled={!loaded}
            onClick={() => {
              void alerts.enableSound()
            }}
          >
            Enable sound
          </Button>
        )}
        <Button
          type="button"
          disabled={!loaded}
          onClick={() => {
            void alerts.testSound()
          }}
        >
          Test sound
        </Button>
        <Typography variant="caption" color="text.secondary" className="!self-center">
          {alerts.soundReady
            ? preferences.soundEnabled
              ? 'Sound ready'
              : 'Alert sound muted'
            : 'Sound needs a click to enable'}
        </Typography>
      </Stack>
      <FormControlLabel
        label="Call reminders — all workspace calls"
        control={
          <Switch
            checked={preferences.callReminders}
            disabled={!loaded || saving}
            onChange={(e) => toggle('callReminders', e.target.checked)}
          />
        }
      />
      <TextField
        select
        label="Call reminder"
        helperText="Also reminds you when the call starts."
        className="!max-w-xs"
        value={preferences.advanceMinutes}
        disabled={!loaded || saving || !preferences.callReminders}
        onChange={(e) => {
          void alerts.savePreferences({ ...preferences, advanceMinutes: Number(e.target.value) })
        }}
      >
        {[5, 10, 15, 30].map((value) => (
          <MenuItem key={value} value={value}>
            {value} minutes before
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        label="Follow-up task reminders"
        control={
          <Switch
            checked={preferences.followUpReminders}
            disabled={!loaded || saving}
            onChange={(e) => toggle('followUpReminders', e.target.checked)}
          />
        }
      />
      <FormControlLabel
        label="Browser notifications when this tab is in the background"
        control={
          <Switch
            checked={preferences.desktopEnabled}
            disabled={!loaded || saving}
            onChange={(e) => {
              if (e.target.checked) void alerts.enableDesktop()
              else void alerts.savePreferences({ ...preferences, desktopEnabled: false })
            }}
          />
        }
      />
      <Typography variant="caption" color="text.secondary">
        Checks for new records every 30 seconds while Income is open. Background tabs and sleeping
        devices can delay alerts. For closed-browser call reminders, download the appointment’s
        calendar event. Browser notification permission may be restricted in the Make preview.
      </Typography>
      {alerts.connection === 'paused' && (
        <Alert
          severity="info"
          action={
            <Button
              type="button"
              onClick={() => {
                void alerts.refresh()
              }}
            >
              Retry
            </Button>
          }
        >
          Alert updates are paused. We’ll retry when the connection returns.
        </Alert>
      )}
    </Stack>
  )
}

export function WorkReminders({
  open,
  onClose,
  onOpen,
}: {
  open: boolean
  onClose: () => void
  onOpen: (notice: WorkspaceNotice) => void
}) {
  const { alerts, leads, preferences, pending, error } = usePortal()
  const [tab, setTab] = useState('Alerts')
  useEffect(() => {
    if (open) setTab('Alerts')
  }, [open])
  const attention = leads.filter(needsAttention)
  const time = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      timeZone: preferences.timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="reminders-title">
      <DialogTitle id="reminders-title">Work reminders</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        aria-label="Reminder sections"
        className="[&_.MuiTab-root]:min-w-0 [&_.MuiTab-root]:px-2"
      >
        {['Alerts', 'Calls', 'Settings'].map((value) => (
          <Tab
            key={value}
            value={value}
            label={value}
            id={`reminder-tab-${value}`}
            aria-controls={`reminder-panel-${value}`}
          />
        ))}
      </Tabs>
      <DialogContent
        role="tabpanel"
        id={`reminder-panel-${tab}`}
        aria-labelledby={`reminder-tab-${tab}`}
      >
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {tab === 'Settings' && <AlertSettings />}
          {tab === 'Alerts' && (
            <>
              <SectionHeader title="Recent alerts" count={alerts.inbox.length} />
              {!alerts.inbox.length && (
                <Typography variant="body2" color="text.secondary">
                  No new alerts. Existing leads won’t ring again just because you reopen the
                  dashboard.
                </Typography>
              )}
              {alerts.inbox.map((notice) => (
                <Box key={notice.key} className="rounded-lg border border-neutral-800 p-4">
                  <Box className="flex items-start justify-between gap-3">
                    <Box>
                      <Typography variant="body2">{notice.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {notice.detail}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={`Dismiss ${notice.title}`}
                      onClick={() => alerts.dismiss(notice)}
                    >
                      <X size={16} />
                    </IconButton>
                  </Box>
                  <Stack direction="row" spacing={1} className="!mt-3">
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={pending}
                      onClick={() => onOpen(notice)}
                    >
                      View {notice.section === 'calendar' ? 'call' : 'record'}
                    </Button>
                    {notice.kind !== 'lead' && (
                      <Button
                        size="small"
                        onClick={() => {
                          void alerts.snooze(notice)
                        }}
                      >
                        Snooze 5 minutes
                      </Button>
                    )}
                  </Stack>
                </Box>
              ))}
            </>
          )}
          {tab === 'Calls' && (
            <>
              <SectionHeader title="Scheduled calls · next 24 hours" count={alerts.calls.length} />
              {alerts.calls.map((call) => (
                <ButtonBase
                  key={call.documentId}
                  className="ip-command-row"
                  disabled={pending}
                  onClick={() =>
                    onOpen({
                      key: `view:${call.documentId}`,
                      kind: 'call',
                      title: call.title,
                      detail: call.owner,
                      section: 'calendar',
                      recordId: call.id,
                      dueAt: Date.parse(call.start),
                      createdAt: Date.now(),
                    })
                  }
                >
                  <Bell size={16} />
                  <Box>
                    <Typography variant="body2">{call.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {time(call.start)} · {call.owner}
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
              {!alerts.calls.length && (
                <Typography variant="body2" color="text.secondary">
                  No scheduled calls in the next 24 hours.
                </Typography>
              )}
            </>
          )}
          {tab === 'Alerts' && (
            <>
              <SectionHeader title="Lead review queue" count={attention.length} />
              {attention.slice(0, 10).map((lead) => (
                <ButtonBase
                  key={lead.id}
                  className="ip-command-row"
                  disabled={pending}
                  onClick={() =>
                    onOpen({
                      key: `queue:${lead.documentId}`,
                      kind: 'follow-up',
                      title: 'Review lead',
                      detail: lead.name,
                      section: 'leads',
                      recordId: lead.id,
                      dueAt: Date.now(),
                      createdAt: Date.now(),
                    })
                  }
                >
                  <Box>
                    <Typography variant="body2">{lead.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lead.nextAction || 'Review, follow up, or assign an owner'}
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
              {!attention.length && (
                <Typography variant="body2" color="text.secondary">
                  The lead review queue is clear.
                </Typography>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
export function WorkspaceAlertToast({
  onOpen,
  onShowInbox,
}: {
  onOpen: (notice: WorkspaceNotice) => void
  onShowInbox: () => void
}) {
  const { alerts, pending } = usePortal()
  const notice = alerts.toast
  return (
    <Snackbar
      key={notice?.key}
      open={Boolean(notice)}
      autoHideDuration={10000}
      onClose={(_, reason) => {
        if (reason !== 'clickaway') alerts.closeToast()
      }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert
        severity="info"
        onClose={alerts.closeToast}
        action={
          notice ? (
            <Button
              size="small"
              disabled={pending}
              onClick={() => {
                if (notice.grouped) {
                  alerts.closeToast()
                  onShowInbox()
                } else onOpen(notice)
              }}
            >
              {notice.grouped ? 'Review' : 'View'}
            </Button>
          ) : undefined
        }
      >
        <Typography variant="body2">{notice?.title}</Typography>
        <Typography variant="caption">{notice?.detail}</Typography>
      </Alert>
    </Snackbar>
  )
}
