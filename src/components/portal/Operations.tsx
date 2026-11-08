import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  Tabs,
  Tab,
  TextField,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
} from '@mui/material'
import { ArrowRight, Check, FileText, LockKeyhole, Users } from 'lucide-react'
import { usePortal, useUnsavedChanges } from './context'
import { TeamWorkspace } from './AdminControls'
import { AlertSettings } from './WorkspaceNotifications'
import { formatDate, money, type Payment } from './model'
import { EmptyState, Heading, PageTitle, RowArrow, SectionHeader, SelectField, Status } from './ui'

export function Payments() {
  const { payments, updatePayment, data, pending, error } = usePortal()
  const [view, setView] = useState('Client')
  const [selected, setSelected] = useState<Payment | null>(null)
  const [filter, setFilter] = useState('All statuses')
  const savedPayment = payments.find((payment) => payment.id === selected?.id)
  const paymentDirty = Boolean(
    selected &&
    savedPayment &&
    (selected.status !== savedPayment.status ||
      (selected.reviewNotes || '') !== (savedPayment.reviewNotes || '')),
  )
  useUnsavedChanges(paymentDirty)
  const closePayment = () => {
    if (paymentDirty && !window.confirm('Discard unsaved payment review changes?')) return
    setSelected(null)
  }
  const rows = payments.filter(
    (p) =>
      (view === 'Proof uploads' ? p.proof : p.kind === view) &&
      (filter === 'All statuses' || p.status === filter),
  )
  const received = payments
    .filter((p) => ['Confirmed', 'Wire received'].includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0)
  return (
    <>
      <PageTitle
        title="Payments"
        description="Separate client wires, program payments, and proof review. No guesswork."
      >
        <Box className="ip-inline">
          <LockKeyhole size={15} />
          <Typography variant="caption" color="text.secondary">
            Record review · No transactions processed
          </Typography>
        </Box>
      </PageTitle>
      <Box className="ip-payment-summary">
        <Box>
          <Typography variant="caption" color="text.secondary">
            Recorded received
          </Typography>
          <Typography className="ip-summary-value">{money(received)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Awaiting payment
          </Typography>
          <Typography className="ip-summary-value">
            {money(
              payments
                .filter((p) => p.status === 'Wire pending')
                .reduce((sum, p) => sum + p.amount, 0),
            )}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Proofs to review
          </Typography>
          <Typography className="ip-summary-value">
            {payments.filter((p) => p.status === 'Proof submitted').length}
          </Typography>
        </Box>
      </Box>
      <Tabs
        value={view}
        onChange={(_, value) => {
          setView(value)
          setFilter('All statuses')
        }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {['Client', 'Elite', 'Proof uploads', 'Wire settings'].map((v) => (
          <Tab
            label={v === 'Client' ? 'Client payments' : v === 'Elite' ? 'Elite payments' : v}
            value={v}
            key={v}
          />
        ))}
      </Tabs>
      {view === 'Wire settings' ? (
        <Box className="ip-panel ip-wire-settings">
          <SectionHeader title="Secure wire instructions" />
          <Box className="ip-inset">
            <Alert severity="info" icon={<LockKeyhole size={18} />}>
              Production bank details are not available in this design preview.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Wire settings must be configured and verified in the connected admin system. No bank
              account numbers, payment links, or hardcoded fallback instructions are provided here.
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          <Box className="ip-payment-toolbar">
            <Typography variant="body2" color="text.secondary">
              {rows.length} records · All values in USD
            </Typography>
            <Box className="ip-sort">
              <SelectField
                label="Status"
                value={filter}
                options={[
                  'All statuses',
                  'Wire pending',
                  'Wire received',
                  'Proof submitted',
                  'Confirmed',
                  'Needs review',
                ]}
                onChange={setFilter}
              />
            </Box>
          </Box>
          {rows.length ? (
            <TableContainer className="ip-payment-table">
              <Table aria-label="Payments">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((payment) => (
                    <TableRow key={payment.id} hover onClick={() => setSelected(payment)}>
                      <TableCell className="ip-payment-client">
                        <ButtonBase className="ip-lead-name" onClick={() => setSelected(payment)}>
                          <Typography className="ip-name">{payment.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {payment.service}
                          </Typography>
                        </ButtonBase>
                      </TableCell>
                      <TableCell className="ip-payment-reference" data-label="Reference">
                        {payment.id}
                      </TableCell>
                      <TableCell className="ip-payment-status">
                        <Status label={payment.status} />
                      </TableCell>
                      <TableCell className="ip-payment-date" data-label="Recorded">
                        {formatDate(payment.date)}
                      </TableCell>
                      <TableCell align="right" className="ip-payment-amount" data-label="Amount">
                        {money(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <RowArrow />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState onReset={() => setFilter('All statuses')} />
          )}
        </>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={closePayment}
        fullWidth
        maxWidth="sm"
        aria-labelledby="payment-detail-title"
      >
        <DialogTitle id="payment-detail-title">Payment record</DialogTitle>
        <DialogContent>
          {selected && (
            <Box className="ip-dialog-form">
              <Box>
                <Heading>{selected.name}</Heading>
                <Typography variant="body2" color="text.secondary">
                  {selected.id} · {selected.service}
                </Typography>
              </Box>
              <Typography className="ip-summary-value">{money(selected.amount)}</Typography>
              <SelectField
                label="Recorded status"
                value={selected.status}
                options={
                  selected.kind === 'Client'
                    ? ['Wire pending', 'Wire received', 'Needs review', 'Rejected']
                    : ['Proof submitted', 'Confirmed', 'Needs review', 'Rejected']
                }
                onChange={(status) => setSelected({ ...selected, status })}
              />
              <Typography variant="caption" color="text.secondary">
                {selected.proofURL
                  ? 'Proof file is available for authorized review.'
                  : selected.proof
                    ? 'Proof was recorded as submitted, but no file is attached.'
                    : 'No proof submitted.'}
              </Typography>
              {selected.proofURL && (
                <Button
                  variant="outlined"
                  href={selected.proofURL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open proof file
                </Button>
              )}
              <TextField
                label="Review notes / rejection reason"
                required={selected.status === 'Rejected'}
                multiline
                minRows={3}
                value={selected.reviewNotes || ''}
                onChange={(e) => setSelected({ ...selected, reviewNotes: e.target.value })}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Alert icon={false} severity="info">
                This updates the administrative record. It does not verify bank balances, move
                funds, or grant customer access.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePayment} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!paymentDirty || pending || !data?.user.canManage}
            onClick={async () => {
              if (selected && paymentDirty && (await updatePayment(selected))) setSelected(null)
            }}
          >
            Save review
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const settingsSections = [
  'General',
  'Team & availability',
  'Users & invitations',
  'Webinar room',
  'Recordings',
  'Emails',
  'Audit log',
]
export function Settings() {
  const {
    preferences,
    updatePreferences,
    activities,
    workingHours: teamHours,
    updateWorkingHours,
    data,
    run,
    pending,
    navigate,
    error,
  } = usePortal()
  const [section, setSection] = useState('General')
  const [draft, setDraft] = useState(preferences)
  const [team, setTeam] = useState(Object.keys(teamHours)[0] || '')
  const savedHours = teamHours[team] || { start: '09:00', end: '17:00' }
  const [hours, setHours] = useState(savedHours)
  const [newHost, setNewHost] = useState({
    name: '',
    role: 'Advisor',
    availableFrom: '09:00',
    availableUntil: '17:00',
  })
  const [hostOpen, setHostOpen] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences)
  const hoursDirty = JSON.stringify(hours) !== JSON.stringify(savedHours)
  useUnsavedChanges(dirty || hoursDirty)
  useEffect(() => setDraft(preferences), [preferences])
  const changeSection = (value: string) => {
    if (value === section) return
    if ((dirty || hoursDirty) && !window.confirm('Discard unsaved settings changes?')) return
    setHours(savedHours)
    setDraft(preferences)
    setSection(value)
  }
  return (
    <>
      <PageTitle
        title="Settings"
        description="Manage your workspace, people, access, and operational history."
      />
      <Box className="ip-settings-grid">
        <Box component="nav" aria-label="Settings sections" className="ip-settings-nav">
          {settingsSections.map((item) => (
            <Button
              key={item}
              className={section === item ? 'is-selected' : ''}
              onClick={() => changeSection(item)}
            >
              {item}
              {item === section && <RowArrow />}
            </Button>
          ))}
        </Box>
        <Box className="ip-settings-content">
          <SectionHeader title={section} />
          {section === 'General' && (
            <Box
              component="form"
              className="ip-settings-form"
              onSubmit={async (e) => {
                e.preventDefault()
                if (draft.workspace.trim())
                  await updatePreferences({ ...draft, workspace: draft.workspace.trim() })
              }}
            >
              <TextField
                label="Workspace name"
                required
                value={draft.workspace}
                disabled={!data?.user.canManage}
                onChange={(e) => setDraft({ ...draft, workspace: e.target.value })}
              />
              <SelectField
                label="Default calendar timezone"
                value={draft.timezone}
                options={[
                  'America/New_York',
                  'America/Chicago',
                  'America/Los_Angeles',
                  'Europe/London',
                ]}
                onChange={(timezone) => setDraft({ ...draft, timezone })}
              />
              <Box className="ip-setting-switch">
                <Box>
                  <Typography className="ip-name">Workspace reminders</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Allow lead alerts, call reminders and follow-up prompts.
                  </Typography>
                </Box>
                <FormControlLabel
                  label="Enable reminders"
                  control={
                    <Switch
                      checked={draft.notifications}
                      onChange={(e) => setDraft({ ...draft, notifications: e.target.checked })}
                    />
                  }
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Preferences are stored in Payload and available after reload.
              </Typography>
              <Box className="ip-form-actions">
                <Typography variant="caption" color="text.secondary">
                  {dirty ? 'Unsaved changes' : 'All changes saved'}
                </Typography>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={pending || !dirty || !draft.workspace.trim() || !data?.user.canManage}
                >
                  Save preferences
                </Button>
              </Box>
            </Box>
          )}
          {section === 'General' && (
            <Box className="ip-settings-form border-t border-neutral-800">
              <AlertSettings />
            </Box>
          )}
          {section === 'Team & availability' && (
            <Box className="ip-settings-form">
              <Alert severity="info">
                Scheduling hosts are managed here. Staff login invitations are managed in Users &
                invitations. Availability is Monday–Friday, Eastern time.
              </Alert>
              {data?.user.canManage && (
                <Button variant="outlined" onClick={() => setHostOpen(true)}>
                  Add scheduling host
                </Button>
              )}
              {Object.keys(teamHours).length ? (
                <>
                  <SelectField
                    label="Team member"
                    value={team}
                    options={Object.keys(teamHours)}
                    onChange={(value) => {
                      if (hoursDirty && !window.confirm('Discard unsaved working hours?')) return
                      setTeam(value)
                      setHours(teamHours[value])
                    }}
                  />
                  <Box className="ip-form-two">
                    <TextField
                      label="Available from"
                      type="time"
                      value={hours.start}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(e) => setHours({ ...hours, start: e.target.value })}
                    />
                    <TextField
                      label="Available until"
                      type="time"
                      value={hours.end}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(e) => setHours({ ...hours, end: e.target.value })}
                    />
                  </Box>
                  {hours.start >= hours.end && (
                    <Alert severity="error">End time must be later than start time.</Alert>
                  )}
                  <Button
                    variant="contained"
                    disabled={
                      pending ||
                      !hoursDirty ||
                      !hours.start ||
                      hours.start >= hours.end ||
                      !data?.user.canManage
                    }
                    onClick={async () => {
                      await updateWorkingHours(team, hours)
                    }}
                  >
                    Save working hours
                  </Button>
                </>
              ) : (
                <EmptyState
                  title="No scheduling hosts"
                  description="Add a host to enable assignment and appointment scheduling."
                />
              )}
            </Box>
          )}
          {section === 'Users & invitations' && (
            <Box className="ip-settings-form">
              <TeamWorkspace />
            </Box>
          )}
          {section === 'Webinar room' && (
            <Box className="ip-settings-form">
              <Typography variant="body2" color="text.secondary">
                Session details, registration, room links, reminders, and replays now have a
                dedicated workspace in this dashboard.
              </Typography>
              <Button variant="contained" onClick={() => navigate('webinars')}>
                Manage webinars
              </Button>
            </Box>
          )}
          {section === 'Recordings' && (
            <Box className="ip-settings-form">
              {data?.webinars
                .filter((w) => w.replayURL)
                .map((w) => (
                  <Box key={w.id} className="ip-readonly-row">
                    <Typography className="ip-name">{w.title}</Typography>
                    <Status label={w.replayPublished ? 'Published' : 'Draft'} />
                    <Button onClick={() => navigate('webinars', w.id)}>Manage replay</Button>
                  </Box>
                ))}
              {!data?.webinars.some((w) => w.replayURL) && (
                <EmptyState
                  title="No replays configured"
                  description="Add and publish a replay from its webinar workspace."
                />
              )}
              <Button variant="outlined" onClick={() => navigate('webinars')}>
                Open webinars
              </Button>
            </Box>
          )}
          {section === 'Emails' && (
            <Box className="ip-settings-form">
              <Alert severity={data?.emailConfigured ? 'success' : 'warning'}>
                {data?.emailConfigured
                  ? 'Resend is connected. Sent means accepted by the provider, not confirmed delivery.'
                  : 'Email is not configured. Email invitations and email notifications are disabled until a verified sender and sending key are configured. In-app alerts work independently.'}
              </Alert>
              {data?.messages.map((message) => (
                <Box key={message.id} className="ip-readonly-row">
                  <Box>
                    <Typography variant="body2">{message.subject}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {message.recipient} · {new Date(message.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Status label={message.status} />
                </Box>
              ))}
              {!data?.messages.length && (
                <Typography variant="body2" color="text.secondary">
                  No delivery activity yet.
                </Typography>
              )}
            </Box>
          )}
          {section === 'Audit log' && (
            <Box>
              {activities.map((item) => (
                <Box className="ip-audit-row" key={item.id}>
                  <Box className="ip-line-icon">
                    <Check size={14} />
                  </Box>
                  <Box>
                    <Typography className="ip-name">{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.actor} · {item.detail}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </Typography>
                </Box>
              ))}
              {!activities.length && (
                <EmptyState
                  title="No recorded changes"
                  description="Saved changes appear here with the time and responsible administrator."
                />
              )}
            </Box>
          )}
        </Box>
      </Box>
      <Dialog
        open={hostOpen}
        onClose={() => {
          if (!pending) setHostOpen(false)
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="new-host-title"
      >
        <DialogTitle id="new-host-title">Add scheduling host</DialogTitle>
        <DialogContent>
          <Box className="ip-dialog-form">
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Display name"
              required
              value={newHost.name}
              onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
            />
            <TextField
              label="Role / title"
              value={newHost.role}
              onChange={(e) => setNewHost({ ...newHost, role: e.target.value })}
            />
            <TextField
              label="Available from (Eastern)"
              type="time"
              value={newHost.availableFrom}
              onChange={(e) => setNewHost({ ...newHost, availableFrom: e.target.value })}
            />
            <TextField
              label="Available until (Eastern)"
              type="time"
              value={newHost.availableUntil}
              onChange={(e) => setNewHost({ ...newHost, availableUntil: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHostOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={pending || !newHost.name.trim()}
            onClick={async () => {
              if (await run('createTeamMember', newHost)) {
                setHostOpen(false)
                setTeam(newHost.name)
                setHours({ start: newHost.availableFrom, end: newHost.availableUntil })
              }
            }}
          >
            Add host
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
