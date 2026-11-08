import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Copy,
  Download,
  Plus,
  Send,
  Users,
  Video,
} from 'lucide-react'
import { usePortal, useUnsavedChanges, type Webinar } from './context'
import { EmptyState, PageTitle, SectionHeader, SelectField, Status } from './ui'
import { LeadTools } from './AdminControls'
import { exportLeads } from './model'

const blank = () => ({
  title: '',
  startsAt: '',
  timezone: 'America/New_York',
  host: '',
  duration: 60,
  capacity: 250,
  status: 'Draft',
  registrationOpen: false,
  waitlistEnabled: true,
  joinURL: '',
  hostURL: '',
  replayURL: '',
  replayPublished: false,
  description: '',
  cancellationReason: '',
})
function editorValue(session: Webinar) {
  const {
    title,
    startsAt,
    timezone,
    host,
    duration,
    capacity,
    status,
    registrationOpen,
    waitlistEnabled,
    replayPublished,
  } = session
  return {
    title,
    startsAt: startsAt.slice(0, 16),
    timezone,
    host,
    duration,
    capacity,
    status,
    registrationOpen,
    waitlistEnabled,
    replayPublished,
    joinURL: session.joinURL || '',
    hostURL: session.hostURL || '',
    replayURL: session.replayURL || '',
    description: session.description || '',
    cancellationReason: session.cancellationReason || '',
  }
}
type Draft = ReturnType<typeof blank>
function SessionFields({ draft, setDraft }: { draft: Draft; setDraft: (value: Draft) => void }) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Session title"
        required
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <Box className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          label="Start date and time (UTC)"
          type="datetime-local"
          required
          value={draft.startsAt}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
        />
        <SelectField
          label="Display timezone"
          value={draft.timezone}
          options={['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London']}
          onChange={(timezone) => setDraft({ ...draft, timezone })}
        />
        <TextField
          label="Host"
          required
          value={draft.host}
          onChange={(e) => setDraft({ ...draft, host: e.target.value })}
        />
        <TextField
          label="Duration (minutes)"
          type="number"
          value={draft.duration}
          onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
        />
        <TextField
          label="Capacity"
          type="number"
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
        />
        <SelectField
          label="Session status"
          value={draft.status}
          options={['Draft', 'Scheduled', 'Live', 'Completed', 'Cancelled']}
          onChange={(status) => setDraft({ ...draft, status })}
        />
      </Box>
      <TextField
        label="Session description"
        multiline
        minRows={3}
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <TextField
        label="Attendee join link (HTTPS)"
        value={draft.joinURL}
        onChange={(e) => setDraft({ ...draft, joinURL: e.target.value })}
      />
      <TextField
        label="Private host console link (HTTPS)"
        value={draft.hostURL}
        helperText="Visible only to managers and administrators."
        onChange={(e) => setDraft({ ...draft, hostURL: e.target.value })}
      />
      <FormControlLabel
        label="Registration open"
        control={
          <Checkbox
            checked={draft.registrationOpen}
            onChange={(e) => setDraft({ ...draft, registrationOpen: e.target.checked })}
          />
        }
      />
      <FormControlLabel
        label="Enable waitlist"
        control={
          <Checkbox
            checked={draft.waitlistEnabled}
            onChange={(e) => setDraft({ ...draft, waitlistEnabled: e.target.checked })}
          />
        }
      />
      {draft.status === 'Cancelled' && (
        <TextField
          label="Cancellation reason"
          required
          value={draft.cancellationReason}
          onChange={(e) => setDraft({ ...draft, cancellationReason: e.target.value })}
        />
      )}
      <Alert severity="info">
        Session status is an administrative record. Use the configured host console to start, end or
        moderate the actual broadcast. Changing a session does not automatically email registrants.
      </Alert>
    </Stack>
  )
}

export function WebinarWorkspace() {
  const { data, route, navigate } = usePortal()
  const [filter, setFilter] = useState('All sessions')
  const [create, setCreate] = useState(false)
  const [draft, setDraft] = useState<Draft>(blank)
  const selected = data?.webinars.find((session) => session.id === route.id)
  if (route.id)
    return selected ? (
      <SessionWorkspace key={selected.id} session={selected} />
    ) : (
      <>
        <Button onClick={() => navigate('webinars')}>Back to webinars</Button>
        <EmptyState
          title="Webinar not found"
          description="This session may no longer be available."
        />
      </>
    )
  const sessions = (data?.webinars || []).filter(
    (session) => filter === 'All sessions' || session.status === filter,
  )
  return (
    <>
      <PageTitle
        eyebrow="EVENT OPERATIONS"
        title="Webinars"
        description="Manage every session, registrant, and next conversation in one place."
      >
        {data?.user.canManage && (
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => {
              setDraft(blank())
              setCreate(true)
            }}
          >
            Create webinar
          </Button>
        )}
      </PageTitle>
      <Box className="ip-metrics !mb-6">
        {[
          ['Upcoming sessions', data?.webinars.filter((s) => s.status === 'Scheduled').length || 0],
          [
            'Registered',
            data?.leads.filter((l) => l.source === 'Webinar' && !l.archived).length || 0,
          ],
          [
            'Attended',
            data?.leads.filter((l) => l.source === 'Webinar' && l.attendance === 'Attended')
              .length || 0,
          ],
          [
            'Follow-up needed',
            data?.leads.filter(
              (l) => l.source === 'Webinar' && l.followUpStatus === 'Follow-Up Needed',
            ).length || 0,
          ],
        ].map(([label, value]) => (
          <Box key={label} className="p-5">
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h1" className="!mt-2">
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Tabs
        value={filter}
        onChange={(_, value) => setFilter(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Webinar status"
      >
        {['All sessions', 'Scheduled', 'Live', 'Completed', 'Draft', 'Cancelled'].map((value) => (
          <Tab key={value} value={value} label={value} />
        ))}
      </Tabs>
      <Box className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {sessions.map((session) => {
          const count =
            data?.leads.filter(
              (l) =>
                l.webinar === session.id &&
                !l.archived &&
                l.registrationStatus !== 'Cancelled' &&
                l.registrationStatus !== 'Waitlisted',
            ).length || 0
          return (
            <ButtonBase
              key={session.id}
              className="ip-panel !block !p-6 !text-left"
              onClick={() => navigate('webinars', session.id)}
            >
              <Box className="mb-5 flex items-center justify-between gap-4">
                <Video size={20} />
                <Status label={session.status} />
              </Box>
              <Typography variant="h2">{session.title}</Typography>
              <Typography variant="body2" color="text.secondary" className="!mt-3">
                {new Date(session.startsAt).toLocaleString('en-US', {
                  timeZone: session.timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                · {session.timezone}
              </Typography>
              <Box className="mt-6 flex flex-wrap justify-between gap-3 border-t border-neutral-800 pt-4">
                <Typography variant="caption">
                  {count} / {session.capacity} registered
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {session.registrationOpen ? 'Registration open' : 'Registration closed'}
                </Typography>
              </Box>
            </ButtonBase>
          )
        })}
      </Box>
      {!sessions.length && (
        <EmptyState
          title="No sessions in this view"
          description="Create a webinar or choose a different status."
        />
      )}
      <SessionCreate
        open={create}
        draft={draft}
        setDraft={setDraft}
        close={() => setCreate(false)}
      />
    </>
  )
}
function SessionCreate({
  open,
  draft,
  setDraft,
  close,
}: {
  open: boolean
  draft: Draft
  setDraft: (v: Draft) => void
  close: () => void
}) {
  const { run, pending, error } = usePortal()
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending && window.confirm('Discard this unsaved session?')) close()
      }}
      fullWidth
      maxWidth="md"
      aria-labelledby="create-webinar-title"
    >
      <DialogTitle id="create-webinar-title">Create webinar</DialogTitle>
      <DialogContent>
        <Box className="pt-2">
          {error && (
            <Alert severity="error" className="!mb-4">
              {error}
            </Alert>
          )}
          <SessionFields draft={draft} setDraft={setDraft} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button disabled={pending} onClick={close}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={pending || !draft.title || !draft.host || !draft.startsAt}
          onClick={async () => {
            if (
              await run('createWebinar', {
                ...draft,
                startsAt: new Date(`${draft.startsAt}Z`).toISOString(),
              })
            )
              close()
          }}
        >
          Create session
        </Button>
      </DialogActions>
    </Dialog>
  )
}
function SessionWorkspace({ session }: { session: Webinar }) {
  const { data, run, pending, navigate, error } = usePortal()
  const [tab, setTab] = useState('Overview')
  const [draft, setDraft] = useState(() => editorValue(session))
  useEffect(() => setDraft(editorValue(session)), [session.updatedAt])
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [messageType, setMessageType] = useState('Reminder')
  const [confirmSend, setConfirmSend] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [duplicateDraft, setDuplicateDraft] = useState<Draft>(blank)
  const dirty = JSON.stringify(draft) !== JSON.stringify(editorValue(session))
  useUnsavedChanges(dirty)
  const registrants = data?.leads.filter((l) => l.webinar === session.id && !l.archived) || []
  const visible = registrants.filter((l) =>
    `${l.name} ${l.email}`.toLowerCase().includes(query.toLowerCase()),
  )
  const stats = [
    [
      'Registered',
      registrants.filter((l) => !['Waitlisted', 'Cancelled'].includes(l.registrationStatus || ''))
        .length,
    ],
    ['Attended', registrants.filter((l) => l.attendance === 'Attended').length],
    ['Waitlisted', registrants.filter((l) => l.registrationStatus === 'Waitlisted').length],
    ['Applied', registrants.filter((l) => l.followUpStatus === 'Applied').length],
  ]
  const changeTab = (value: string) => {
    setTab(value)
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportLeads(visible)], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'webinar-registrants.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <Button
        startIcon={<ArrowLeft size={15} />}
        className="!mb-5"
        onClick={() => navigate('webinars')}
      >
        All webinars
      </Button>
      <PageTitle
        eyebrow="WEBINAR WORKSPACE"
        title={session.title}
        description={`${new Date(session.startsAt).toLocaleString('en-US', { timeZone: session.timezone, dateStyle: 'medium', timeStyle: 'short' })} · ${session.timezone} · ${session.host}`}
      >
        <Status label={session.status} />
        {session.hostURL && data?.user.canManage && (
          <Button
            variant="contained"
            href={session.hostURL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<ArrowUpRight size={15} />}
          >
            Open host console
          </Button>
        )}
        {session.joinURL && (
          <Button
            variant="outlined"
            href={session.joinURL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Preview attendee room
          </Button>
        )}
        {data?.user.canManage && session.status !== 'Cancelled' && (
          <Button
            color="warning"
            onClick={() => {
              setTab('Overview')
              setDraft({ ...draft, status: 'Cancelled' })
            }}
          >
            Cancel session
          </Button>
        )}
      </PageTitle>
      <Box className="ip-metrics !mb-6">
        {stats.map(([label, value]) => (
          <Box key={label} className="p-5">
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h1" className="!mt-2">
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box className="ip-record-actions">
        <Typography variant="body2">
          {dirty
            ? 'Unsaved session changes'
            : `Registration ${session.registrationOpen ? 'open' : 'closed'} · ${registrants.length} registrants`}
        </Typography>
        {data?.user.canManage && (
          <Stack direction="row" spacing={1}>
            <Button disabled={pending || !dirty} onClick={() => setDraft(editorValue(session))}>
              Discard
            </Button>
            <Button
              variant="contained"
              disabled={pending || !dirty || !draft.startsAt}
              onClick={async () => {
                if (
                  draft.status === 'Cancelled' &&
                  !window.confirm(
                    `Cancel ${session.title}? Registration will close. Notifications are sent separately.`,
                  )
                )
                  return
                await run(
                  'saveWebinar',
                  { ...draft, startsAt: new Date(`${draft.startsAt}Z`).toISOString() },
                  session.id,
                  session.updatedAt,
                )
              }}
            >
              Save session
            </Button>
          </Stack>
        )}
      </Box>
      <Tabs
        value={tab}
        onChange={(_, value) => changeTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Webinar workspace tabs"
      >
        {['Overview', 'Registrants', 'Communications', 'Replay', 'Activity'].map((value) => (
          <Tab key={value} value={value} label={value} />
        ))}
      </Tabs>
      <Box className="ip-panel !mt-5 !p-5 sm:!p-6">
        {tab === 'Overview' && (
          <Stack spacing={4}>
            <Box className="grid gap-3 md:grid-cols-2">
              <Alert severity={session.joinURL ? 'success' : 'warning'}>
                {session.joinURL
                  ? 'Attendee room configured'
                  : 'Add an attendee room link before sending invitations.'}
              </Alert>
              <Alert severity={data?.emailConfigured ? 'success' : 'warning'}>
                {data?.emailConfigured
                  ? 'Email provider connected'
                  : 'Email provider not configured'}
              </Alert>
            </Box>
            {data?.user.canManage ? (
              <>
                <SessionFields draft={draft} setDraft={setDraft} />
                <Button
                  startIcon={<Copy size={15} />}
                  variant="outlined"
                  className="!self-start"
                  onClick={() => {
                    setDuplicateDraft({
                      ...draft,
                      title: `${draft.title} — copy`,
                      status: 'Draft',
                      registrationOpen: false,
                    })
                    setDuplicate(true)
                  }}
                >
                  Duplicate as a new draft
                </Button>
              </>
            ) : (
              <Typography color="text.secondary">
                {session.description || 'No session description.'}
              </Typography>
            )}
          </Stack>
        )}
        {tab === 'Registrants' && (
          <Stack spacing={3}>
            <Box className="flex flex-wrap justify-between gap-3">
              <LeadTools webinar={session.id} />
              <Button startIcon={<Download size={15} />} onClick={download}>
                Export visible registrants
              </Button>
            </Box>
            <TextField
              label="Search registrants"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {visible.map((lead) => (
              <Box
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4"
              >
                <Button onClick={() => navigate('leads', lead.id)}>{lead.name}</Button>
                <Typography variant="caption" color="text.secondary">
                  {lead.email}
                </Typography>
                <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
                  <Status label={lead.registrationStatus || 'Registered'} />
                  <Status label={lead.attendance || 'Not recorded'} />
                  <Status label={lead.followUpStatus || 'Not started'} />
                </Stack>
              </Box>
            ))}
            {!visible.length && (
              <EmptyState
                title="No registrants yet"
                description="Add a registrant to this session. Registration identity is retained separately from applications."
              />
            )}
          </Stack>
        )}
        {tab === 'Communications' && (
          <Stack spacing={3}>
            <Alert severity={data?.emailConfigured ? 'info' : 'warning'}>
              {data?.emailConfigured
                ? 'Choose recipients and review the message before sending. “Sent” means accepted by the provider, not confirmed delivery.'
                : 'Connect Resend to send invitations, reminders and follow-up. No messages have been sent.'}
            </Alert>
            <SelectField
              label="Message type"
              value={messageType}
              options={['Invitation', 'Reminder', 'Follow-up', 'Cancellation']}
              onChange={setMessageType}
            />
            <Typography variant="h2">Recipients</Typography>
            <FormControlLabel
              label="Select all eligible registrants"
              control={
                <Checkbox
                  checked={
                    selected.length > 0 &&
                    selected.length ===
                      registrants.filter((l) => l.registrationStatus !== 'Cancelled').length
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? registrants
                            .filter((l) => l.registrationStatus !== 'Cancelled')
                            .map((l) => l.documentId!)
                        : [],
                    )
                  }
                />
              }
            />
            {registrants
              .filter((l) => l.registrationStatus !== 'Cancelled')
              .map((lead) => (
                <FormControlLabel
                  key={lead.id}
                  label={`${lead.name} · ${lead.email}`}
                  control={
                    <Checkbox
                      checked={selected.includes(lead.documentId!)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, lead.documentId!]
                            : selected.filter((id) => id !== lead.documentId),
                        )
                      }
                    />
                  }
                />
              ))}
            <Button
              variant="contained"
              startIcon={<Send size={15} />}
              className="!self-start"
              disabled={
                !selected.length || !data?.emailConfigured || !data.user.canManage || pending
              }
              onClick={() => setConfirmSend(true)}
            >
              Review message · {selected.length} recipients
            </Button>
            <SectionHeader title="Recent delivery activity" />
            {data?.messages
              .filter((m) => registrants.some((l) => l.email === m.recipient))
              .map((m) => (
                <Box
                  key={m.id}
                  className="flex flex-wrap justify-between gap-3 border-b border-neutral-800 pb-3"
                >
                  <Box>
                    <Typography variant="body2">{m.subject}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.recipient}
                    </Typography>
                  </Box>
                  <Status label={m.status} />
                </Box>
              ))}
          </Stack>
        )}
        {tab === 'Replay' && (
          <Stack spacing={3}>
            <TextField
              label="Recording / replay link (HTTPS)"
              disabled={!data?.user.canManage}
              value={draft.replayURL}
              onChange={(e) => setDraft({ ...draft, replayURL: e.target.value })}
            />
            <FormControlLabel
              label="Publish replay availability"
              control={
                <Checkbox
                  disabled={!data?.user.canManage}
                  checked={draft.replayPublished}
                  onChange={(e) => setDraft({ ...draft, replayPublished: e.target.checked })}
                />
              }
            />
            <Alert severity="info">
              Publishing here controls replay availability in webinar follow-up messages. It does
              not change privacy settings at the video host.
            </Alert>
            {session.replayPublished && session.replayURL && (
              <Button
                className="!self-start"
                variant="outlined"
                href={session.replayURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview published replay
              </Button>
            )}
          </Stack>
        )}
        {tab === 'Activity' && (
          <Stack spacing={3}>
            {data?.activities
              .filter((a) => a.recordId === session.id)
              .map((a) => (
                <Box key={a.id}>
                  <Typography variant="body2">{a.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.actor} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''} ·{' '}
                    {a.detail}
                  </Typography>
                </Box>
              ))}
          </Stack>
        )}
      </Box>
      <Dialog
        open={confirmSend}
        onClose={() => {
          if (!pending) setConfirmSend(false)
        }}
        fullWidth
        aria-labelledby="send-webinar-title"
      >
        <DialogTitle id="send-webinar-title">Review {messageType.toLowerCase()}</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography variant="body2">To: {selected.length} selected registrants</Typography>
            <Typography variant="h2">
              {messageType}: {session.title}
            </Typography>
            <Typography>{new Date(session.startsAt).toUTCString()}</Typography>
            <Typography>{session.description}</Typography>
            <Typography>
              {messageType === 'Follow-up' && session.replayPublished
                ? session.replayURL
                : session.joinURL || 'No room link configured'}
            </Typography>
            {messageType === 'Cancellation' && (
              <Alert severity="warning">
                {session.cancellationReason || 'No cancellation reason recorded.'}
              </Alert>
            )}
            <Alert severity="warning">
              This sends real email to the selected addresses. Check the recipients and session
              details before confirming.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setConfirmSend(false)}>
            Back
          </Button>
          <Button
            variant="contained"
            disabled={pending}
            onClick={async () => {
              if (
                await run('sendWebinar', { recipients: selected, kind: messageType }, session.id)
              ) {
                setConfirmSend(false)
                setSelected([])
              }
            }}
          >
            Send to {selected.length} recipients
          </Button>
        </DialogActions>
      </Dialog>
      <SessionCreate
        open={duplicate}
        draft={duplicateDraft}
        setDraft={setDuplicateDraft}
        close={() => setDuplicate(false)}
      />
    </>
  )
}
