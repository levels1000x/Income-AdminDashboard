import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Archive, Plus, Send } from 'lucide-react'
import { usePortal } from './context'
import { owners, type Appointment, type Lead } from './model'
import { SelectField, Status } from './ui'

export function LeadTools({ lead, webinar }: { lead?: Lead; webinar?: string }) {
  const { data, run, pending, navigate, error: serverError } = usePortal()
  const [mode, setMode] = useState('')
  const [reason, setReason] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: webinar ? 'Webinar' : 'Manual',
    service: '',
    owner: 'Unassigned',
    qualification: 'Not reviewed',
    sales: 'Not started',
    nextAction: '',
    followUp: '',
    notes: '',
    registrationStatus: 'Registered',
    attendance: 'Not recorded',
    followUpStatus: 'Not started',
  })
  const [selected, setSelected] = useState<string[]>([])
  const [bulkOwner, setBulkOwner] = useState('Unassigned')
  const [bulkArchive, setBulkArchive] = useState(false)
  const [error, setError] = useState('')
  const manager = data?.user.canManage
  const close = () => {
    if (pending) return
    setMode('')
    setError('')
  }
  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {!lead && (
          <Button startIcon={<Plus size={15} />} variant="contained" onClick={() => setMode('new')}>
            {webinar ? 'Add registrant' : 'New lead'}
          </Button>
        )}
        {!lead && !webinar && manager && (
          <>
            <Button variant="outlined" onClick={() => setMode('bulk')}>
              Bulk actions
            </Button>
            <Button startIcon={<Archive size={15} />} onClick={() => setMode('archived')}>
              Archived leads
            </Button>
          </>
        )}
        {lead && manager && (
          <Button color="warning" variant="outlined" onClick={() => setMode('archive')}>
            Archive lead
          </Button>
        )}
      </Stack>
      <Dialog
        open={Boolean(mode)}
        onClose={close}
        fullWidth
        maxWidth="sm"
        aria-labelledby="lead-tools-title"
      >
        <DialogTitle id="lead-tools-title">
          {mode === 'new'
            ? webinar
              ? 'Add webinar registrant'
              : 'Create lead'
            : mode === 'archive'
              ? 'Archive this lead?'
              : mode === 'bulk'
                ? 'Manage selected leads'
                : 'Archived leads'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} className="!pt-2">
            {error && <Alert severity="error">{error}</Alert>}
            {serverError && <Alert severity="error">{serverError}</Alert>}
            {mode === 'new' && (
              <>
                <Alert severity="info">
                  A new source-native record will be created. Contacts are never automatically
                  merged.
                </Alert>
                {(['name', 'email', 'phone', 'company', 'service'] as const).map((key) => (
                  <TextField
                    key={key}
                    required={key === 'name' || key === 'email'}
                    type={key === 'email' ? 'email' : 'text'}
                    label={key[0].toUpperCase() + key.slice(1)}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                ))}
                <SelectField
                  label="Assigned to"
                  value={form.owner}
                  options={owners}
                  onChange={(owner) => setForm({ ...form, owner })}
                />
                {webinar && (
                  <SelectField
                    label="Registration"
                    value={form.registrationStatus}
                    options={['Registered', 'Confirmed', 'Waitlisted']}
                    onChange={(registrationStatus) => setForm({ ...form, registrationStatus })}
                  />
                )}
              </>
            )}
            {mode === 'archive' && (
              <>
                <Typography>
                  {lead?.name} will leave active queues. The record, appointments and audit history
                  remain available. It can be restored.
                </Typography>
                <TextField
                  required
                  label="Archive reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}
            {mode === 'bulk' && (
              <>
                <Alert severity="info">
                  Select records explicitly. Each record keeps its original identity. Results are
                  reported per batch.
                </Alert>
                <TextField
                  select
                  label="Leads"
                  slotProps={{ select: { multiple: true } }}
                  value={selected}
                  onChange={(e) =>
                    setSelected(
                      typeof e.target.value === 'string'
                        ? e.target.value.split(',')
                        : e.target.value,
                    )
                  }
                >
                  {data?.leads
                    .filter((l) => !l.archived)
                    .map((l) => (
                      <MenuItem key={l.id} value={l.id}>
                        {l.name} · {l.source}
                      </MenuItem>
                    ))}
                </TextField>
                <FormControlLabel
                  label="Archive selected records instead of assigning"
                  control={
                    <Checkbox
                      checked={bulkArchive}
                      onChange={(e) => setBulkArchive(e.target.checked)}
                    />
                  }
                />
                {bulkArchive ? (
                  <TextField
                    label="Archive reason"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                ) : (
                  <SelectField
                    label="Assign selected leads to"
                    value={bulkOwner}
                    options={owners}
                    onChange={setBulkOwner}
                  />
                )}
              </>
            )}
            {mode === 'archived' && (
              <>
                {!data?.leads.some((l) => l.archived) && (
                  <Typography color="text.secondary">No archived leads.</Typography>
                )}
                {data?.leads
                  .filter((l) => l.archived)
                  .map((l) => (
                    <Box
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4"
                    >
                      <Box>
                        <Typography>{l.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l.source} · {l.archiveReason}
                        </Typography>
                      </Box>
                      <Button
                        disabled={pending}
                        onClick={() => {
                          void run(
                            'archiveLead',
                            { archived: false, archiveReason: 'Restored by administrator' },
                            l.documentId,
                            l.updatedAt,
                          )
                        }}
                      >
                        Restore
                      </Button>
                    </Box>
                  ))}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={pending}>
            Close
          </Button>
          {['new', 'archive', 'bulk'].includes(mode) && (
            <Button
              variant="contained"
              color={mode === 'archive' || (bulkArchive && mode === 'bulk') ? 'warning' : 'primary'}
              disabled={
                pending ||
                (mode === 'archive' && !reason.trim()) ||
                (mode === 'bulk' && (!selected.length || (bulkArchive && !reason.trim()))) ||
                (mode === 'new' && (!form.name.trim() || !form.email.trim()))
              }
              onClick={async () => {
                if (mode === 'new') {
                  if (await run('createLead', { ...form, ...(webinar ? { webinar } : {}) })) {
                    close()
                    setForm({ ...form, name: '', email: '', phone: '', company: '' })
                  }
                } else if (mode === 'archive' && lead) {
                  if (
                    await run(
                      'archiveLead',
                      { archived: true, archiveReason: reason },
                      lead.documentId,
                      lead.updatedAt,
                    )
                  ) {
                    close()
                    navigate('leads')
                  }
                } else {
                  if (
                    !window.confirm(
                      `Apply ${bulkArchive ? 'archive' : 'assignment'} to ${selected.length} selected records?`,
                    )
                  )
                    return
                  let saved = 0
                  for (const key of selected) {
                    const row = data?.leads.find((l) => l.id === key)
                    if (
                      row &&
                      (await run(
                        bulkArchive ? 'archiveLead' : 'saveLead',
                        bulkArchive
                          ? { archived: true, archiveReason: reason }
                          : { owner: bulkOwner },
                        row.documentId,
                        row.updatedAt,
                      ))
                    )
                      saved++
                  }
                  if (saved === selected.length) close()
                  else
                    setError(
                      `${saved} of ${selected.length} records updated. Refresh before retrying failed records.`,
                    )
                  setSelected([])
                }
              }}
            >
              {mode === 'new'
                ? 'Create record'
                : mode === 'archive'
                  ? 'Archive lead'
                  : `Apply to ${selected.length} records`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export function AppointmentTools({ call }: { call?: Appointment }) {
  const { leads, run, data, pending, error } = usePortal()
  const [mode, setMode] = useState('')
  const [notify, setNotify] = useState(false)
  const [draft, setDraft] = useState({
    lead: '',
    title: 'Strategy call',
    start: '',
    minutes: 30,
    owner: '',
    status: 'Scheduled',
    outcome: '',
    meetingURL: '',
    cancellationReason: '',
  })
  const open = (value: string) => {
    setDraft(
      call
        ? {
            lead: data?.leads.find((l) => l.id === call.leadId)?.documentId || '',
            title: call.title,
            start: call.start.slice(0, 16),
            minutes: call.minutes,
            owner: call.owner,
            status: value === 'cancel' ? 'Cancelled' : call.status,
            outcome: call.outcome,
            meetingURL: call.meetingURL || '',
            cancellationReason: call.cancellationReason || '',
          }
        : {
            lead: '',
            title: 'Strategy call',
            start: '',
            minutes: 30,
            owner: owners[1] || '',
            status: 'Scheduled',
            outcome: '',
            meetingURL: '',
            cancellationReason: '',
          },
    )
    setMode(value)
  }
  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {!call && (
          <Button variant="contained" startIcon={<Plus size={15} />} onClick={() => open('new')}>
            New appointment
          </Button>
        )}
        {call && (
          <>
            <Button
              variant="outlined"
              href={
                call.documentId
                  ? `/api/appointment-calendar?id=${encodeURIComponent(call.documentId)}`
                  : undefined
              }
              disabled={!call.documentId}
              title="Import into your calendar using your personal reminder timing. Download again after appointment changes."
            >
              Download calendar event
            </Button>
            <Button variant="outlined" onClick={() => open('edit')}>
              Reschedule / edit
            </Button>
            {call.status === 'Scheduled' && (
              <Button color="warning" onClick={() => open('cancel')}>
                Cancel appointment
              </Button>
            )}
            {data?.user.canManage && (
              <Button
                startIcon={<Send size={14} />}
                onClick={() => {
                  if (
                    window.confirm(
                      `Send ${call.status === 'Cancelled' ? 'cancellation' : 'calendar invitation'} to the linked applicant?`,
                    )
                  )
                    void run('sendAppointment', {}, call.documentId)
                }}
                disabled={pending || !data.emailConfigured}
              >
                Send {call.status === 'Cancelled' ? 'cancellation' : 'invitation'}
              </Button>
            )}
          </>
        )}
      </Stack>
      <Dialog
        open={Boolean(mode)}
        onClose={() => {
          if (!pending) setMode('')
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="appointment-tools-title"
      >
        <DialogTitle id="appointment-tools-title">
          {mode === 'cancel'
            ? 'Cancel appointment'
            : call
              ? 'Edit appointment'
              : 'Schedule appointment'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} className="!pt-2">
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              {mode === 'cancel'
                ? 'The appointment and its history are retained. Cancellation does not delete the source application.'
                : 'Times below are UTC. Conflicting appointments for the same host are rejected.'}
            </Alert>
            {mode !== 'cancel' && (
              <>
                <TextField
                  select
                  label="Application"
                  required
                  value={draft.lead}
                  onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
                >
                  {leads
                    .filter((l) => l.source !== 'Webinar')
                    .map((l) => (
                      <MenuItem key={l.id} value={l.documentId}>
                        {l.name} · {l.source}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  label="Title"
                  required
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <TextField
                  type="datetime-local"
                  label="Start (UTC)"
                  required
                  value={draft.start}
                  slotProps={{ inputLabel: { shrink: true } }}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
                <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="Duration (minutes)"
                    type="number"
                    value={draft.minutes}
                    slotProps={{ htmlInput: { min: 15, max: 240 } }}
                    onChange={(e) => setDraft({ ...draft, minutes: Number(e.target.value) })}
                  />
                  <SelectField
                    label="Host"
                    value={draft.owner}
                    options={owners.filter((o) => o !== 'Unassigned')}
                    onChange={(owner) => setDraft({ ...draft, owner })}
                  />
                </Box>
                <TextField
                  label="Meeting link (HTTPS)"
                  value={draft.meetingURL}
                  onChange={(e) => setDraft({ ...draft, meetingURL: e.target.value })}
                />
              </>
            )}
            {mode === 'cancel' && (
              <TextField
                label="Cancellation reason"
                required
                multiline
                value={draft.cancellationReason}
                onChange={(e) => setDraft({ ...draft, cancellationReason: e.target.value })}
              />
            )}
            {call && data?.user.canManage && (
              <FormControlLabel
                label={
                  data.emailConfigured
                    ? 'Notify attendee by email after saving'
                    : 'Email not configured — no email notification will be sent'
                }
                control={
                  <Checkbox
                    checked={notify}
                    disabled={!data.emailConfigured}
                    onChange={(e) => setNotify(e.target.checked)}
                  />
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setMode('')}>
            Keep unchanged
          </Button>
          <Button
            disabled={
              pending ||
              !draft.lead ||
              !draft.start ||
              !draft.owner ||
              (mode === 'cancel' && !draft.cancellationReason.trim())
            }
            variant="contained"
            color={mode === 'cancel' ? 'warning' : 'primary'}
            onClick={async () => {
              const saved = await run(
                call ? 'saveAppointment' : 'createAppointment',
                { ...draft, start: new Date(`${draft.start}Z`).toISOString() },
                call?.documentId,
                call?.updatedAt,
              )
              if (saved) {
                if (notify && call) await run('sendAppointment', {}, call.documentId)
                setMode('')
              }
            }}
          >
            {mode === 'cancel' ? 'Confirm cancellation' : 'Save appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function TeamWorkspace() {
  const { data, run, pending, error } = usePortal()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', email: '', role: 'sales' })
  return (
    <Stack spacing={3}>
      <Alert severity={data?.emailConfigured ? 'info' : 'warning'}>
        {data?.emailConfigured
          ? 'Invitations contain a one-time password setup link, valid for 24 hours. Staff accounts do not grant CMS administrator access.'
          : 'Connect Resend to send staff invitations. Creating fake sent invitations is disabled.'}
      </Alert>
      {data?.user.canManage && (
        <Button
          variant="contained"
          className="!self-start"
          disabled={!data.emailConfigured}
          onClick={() => setOpen(true)}
        >
          Invite team member
        </Button>
      )}
      {data?.users.map((member) => (
        <Box
          key={member.id}
          className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4"
        >
          <Box>
            <Typography>{member.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {member.email} · {member.role}
            </Typography>
          </Box>
          <Status label={member.status} />
          {member.status === 'invited' && (
            <Button
              disabled={pending || !data.emailConfigured}
              onClick={() => {
                void run('resendInvite', {}, member.id)
              }}
            >
              Resend invitation
            </Button>
          )}
          <Button
            disabled={pending || member.id === data.user.id}
            onClick={() => {
              if (
                window.confirm(
                  `${member.status === 'disabled' ? 'Reactivate' : 'Disable / revoke'} this account?`,
                )
              )
                void run(
                  'updateUser',
                  {
                    role: member.role,
                    status: member.status === 'disabled' ? 'active' : 'disabled',
                  },
                  member.id,
                  member.updatedAt,
                )
            }}
          >
            {member.status === 'disabled' ? 'Reactivate' : 'Disable / revoke'}
          </Button>
          <TextField
            select
            size="small"
            label="Role"
            className="!max-w-44"
            value={member.role}
            disabled={pending || member.id === data.user.id}
            onChange={(e) => {
              if (window.confirm('Change this team member’s permissions?'))
                void run(
                  'updateUser',
                  { role: e.target.value, status: member.status },
                  member.id,
                  member.updatedAt,
                )
            }}
          >
            {['administrator', 'manager', 'sales'].map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      ))}
      {!data?.users.length && (
        <Typography color="text.secondary">
          No invited app staff yet. CMS administrators retain their managed access.
        </Typography>
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false)
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="invite-title"
      >
        <DialogTitle id="invite-title">Invite a team member</DialogTitle>
        <DialogContent>
          <Stack spacing={3} className="!pt-2">
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              required
              label="Full name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <TextField
              required
              type="email"
              label="Work email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <SelectField
              label="Role"
              value={draft.role}
              options={['sales', 'manager', 'administrator']}
              onChange={(role) => setDraft({ ...draft, role })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={pending || !draft.name.trim() || !draft.email.trim()}
            onClick={async () => {
              if (await run('inviteUser', draft)) setOpen(false)
            }}
          >
            Send invitation
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
