import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Search,
} from 'lucide-react'
import { usePortal, useUnsavedChanges } from './context'
import {
  dayKey,
  demoToday,
  formatDate,
  shiftDay,
  timeLabel,
  timezoneAbbreviation,
  owners,
} from './model'
import { EmptyState, Heading, PageTitle, RowArrow, SectionHeader, SelectField, Status } from './ui'
import { statusTone } from './status'
import { AppointmentTools } from './AdminControls'

function weekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return shiftDay(date, -(weekday === 0 ? 6 : weekday - 1))
}
export function CalendarWorkspace() {
  const {
    appointments,
    leads: activeLeads,
    data,
    navigate,
    preferences,
    calendar,
    updateCalendar,
  } = usePortal()
  const leads = data?.leads || activeLeads
  const { view, anchor, owner, status, query } = calendar
  const timezone = calendar.timezone || preferences.timezone
  const setView = (value: string) => updateCalendar({ view: value })
  const setAnchor = (value: string) => updateCalendar({ anchor: value })
  const setTimezone = (value: string) => updateCalendar({ timezone: value })
  const setOwner = (value: string) => updateCalendar({ owner: value })
  const setStatus = (value: string) => updateCalendar({ status: value })
  const setQuery = (value: string) => updateCalendar({ query: value })
  const first =
    view === 'Month' ? `${anchor.slice(0, 7)}-01` : view === 'Week' ? weekStart(anchor) : anchor
  const monthDate = new Date(`${first}T12:00:00Z`)
  const daysInMonth = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const days = view === 'Month' ? daysInMonth : 7
  const end = shiftDay(first, days)
  const rows = useMemo(
    () =>
      appointments
        .filter((call) => {
          const lead = leads.find((l) => l.id === call.leadId)
          const date = dayKey(call.start, timezone)
          return (
            date >= first &&
            date < end &&
            (owner === 'Everyone' || call.owner === owner) &&
            (status === 'All statuses' || call.status === status) &&
            `${lead?.name} ${call.title}`.toLowerCase().includes(query.trim().toLowerCase())
          )
        })
        .sort((a, b) => a.start.localeCompare(b.start)),
    [appointments, leads, first, end, timezone, owner, status, query],
  )
  const navigateDate = (direction: number) => {
    if (view !== 'Month') setAnchor(shiftDay(anchor, direction * 7))
    else {
      const date = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`)
      date.setUTCMonth(date.getUTCMonth() + direction)
      setAnchor(date.toISOString().slice(0, 10))
    }
  }
  const title =
    view === 'Month'
      ? monthDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : `${formatDate(first)} – ${formatDate(shiftDay(end, -1))}, ${first.slice(0, 4)}`
  const gridDates =
    view === 'Month'
      ? Array.from({ length: 42 }, (_, i) => shiftDay(weekStart(first), i))
      : Array.from({ length: 7 }, (_, i) => shiftDay(first, i))
  return (
    <>
      <PageTitle
        title="Calendar"
        description="Prepare for conversations. Record the outcome. Keep the next step clear."
      >
        <AppointmentTools />
        <Box className="ip-inline">
          <Clock size={15} />
          <Typography variant="caption" color="text.secondary">
            Times shown in {timezone.split('/')[1]?.replace(/_/g, ' ')}
          </Typography>
        </Box>
      </PageTitle>
      <Box className="ip-calendar-top">
        <Box className="ip-inline">
          <Button variant="outlined" onClick={() => setAnchor(demoToday)}>
            Today
          </Button>
          <Tooltip title="Previous range">
            <IconButton aria-label="Previous date range" onClick={() => navigateDate(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next range">
            <IconButton aria-label="Next date range" onClick={() => navigateDate(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </Tooltip>
          <Heading>{title}</Heading>
        </Box>
        <ToggleButtonGroup
          exclusive
          value={view}
          onChange={(_, value) => value && setView(value)}
          size="small"
          aria-label="Calendar view"
        >
          {['Schedule', 'Week', 'Month'].map((v) => (
            <ToggleButton value={v} key={v}>
              {v}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box className="ip-calendar-filters">
        <TextField
          label="Search appointments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField
          label="Assigned to"
          value={owner}
          options={['Everyone', ...owners.filter((o) => o !== 'Unassigned')]}
          onChange={setOwner}
        />
        <SelectField
          label="Status"
          value={status}
          options={['All statuses', 'Scheduled', 'Completed', 'No-show', 'Cancelled']}
          onChange={setStatus}
        />
        <SelectField
          label="Timezone"
          value={timezone}
          options={['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London']}
          onChange={setTimezone}
        />
      </Box>
      {view === 'Schedule' ? (
        <Box className="ip-panel ip-calendar-schedule">
          {rows.length ? (
            [...new Set(rows.map((a) => dayKey(a.start, timezone)))].map((date) => (
              <Box key={date}>
                <Box className="ip-calendar-day-heading">
                  <Typography variant="body2">
                    {date === demoToday ? 'Today' : formatDate(date)}
                    <Box component="span" className="ip-day-heading-date">
                      {new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </Box>
                  </Typography>
                </Box>
                {rows
                  .filter((a) => dayKey(a.start, timezone) === date)
                  .map((call) => (
                    <ButtonBase
                      className="ip-agenda-row"
                      data-tone={statusTone(call.status)}
                      onClick={() => navigate('calendar', call.id)}
                      key={call.id}
                    >
                      <Box className="ip-agenda-time">
                        <Typography className="ip-name">
                          {timeLabel(call.start, timezone)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {call.minutes} minutes
                        </Typography>
                      </Box>
                      <Box className="ip-agenda-person">
                        <Typography className="ip-name">
                          {leads.find((l) => l.id === call.leadId)?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {call.title}
                        </Typography>
                      </Box>
                      <Typography variant="body2" className="ip-agenda-owner">
                        {call.owner}
                      </Typography>
                      <Status label={call.status} />
                      <RowArrow />
                    </ButtonBase>
                  ))}
              </Box>
            ))
          ) : (
            <EmptyState
              title="No appointments in this range"
              description="Choose another date range or clear the appointment filters."
              onReset={() => {
                setQuery('')
                setOwner('Everyone')
                setStatus('All statuses')
                setAnchor(demoToday)
              }}
            />
          )}
        </Box>
      ) : (
        <Box className={`ip-calendar-grid ${view === 'Week' ? 'is-week' : 'is-month'}`}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <Typography className="ip-grid-weekday" key={day}>
              {day}
            </Typography>
          ))}
          {gridDates.map((date) => (
            <Box
              className={`ip-calendar-cell ${date === demoToday ? 'is-today' : ''} ${
                view === 'Month' && date.slice(0, 7) !== first.slice(0, 7) ? 'is-outside' : ''
              }`}
              key={date}
            >
              <Typography className="ip-calendar-date">{Number(date.slice(-2))}</Typography>
              {rows
                .filter((call) => dayKey(call.start, timezone) === date)
                .map((call) => (
                  <ButtonBase
                    className="ip-calendar-event"
                    data-tone={statusTone(call.status)}
                    aria-label={`${timeLabel(call.start, timezone)}, ${leads.find((l) => l.id === call.leadId)?.name}, ${call.status}`}
                    key={call.id}
                    onClick={() => navigate('calendar', call.id)}
                  >
                    <Typography variant="caption">{timeLabel(call.start, timezone)}</Typography>
                    <Typography variant="caption">
                      {leads.find((l) => l.id === call.leadId)?.name}
                    </Typography>
                    <Typography variant="caption" className="ip-calendar-event-status">
                      {call.status}
                    </Typography>
                  </ButtonBase>
                ))}
            </Box>
          ))}
        </Box>
      )}
      <Box className="ip-result-line">
        <Typography variant="caption" color="text.secondary">
          {rows.length} appointments in this range · Source-linked records only
        </Typography>
      </Box>
    </>
  )
}

export function AppointmentProfile() {
  const {
    route,
    appointments,
    leads,
    navigate,
    updateAppointment,
    calendar,
    preferences,
    pending,
    data,
  } = usePortal()
  const timezone = calendar.timezone || preferences.timezone
  const call = appointments.find((a) => a.id === route.id)
  const lead = (data?.leads || leads).find((l) => l.id === call?.leadId)
  const [draft, setDraft] = useState(call)
  useEffect(() => setDraft(call), [call])
  const dirty = Boolean(call && draft && JSON.stringify(draft) !== JSON.stringify(call))
  useUnsavedChanges(dirty)
  if (!call || !draft)
    return (
      <EmptyState
        title="Appointment not found"
        description="This appointment is not available in the preview."
      />
    )
  return (
    <>
      <Button
        className="ip-back-link"
        startIcon={<ArrowLeft size={15} />}
        onClick={() => navigate('calendar')}
      >
        Back to calendar
      </Button>
      <PageTitle
        eyebrow={call.id}
        title={call.title}
        description={`${lead?.name} · ${formatDate(call.start, timezone)} at ${timeLabel(call.start, timezone)} ${timezoneAbbreviation(call.start, timezone)}`}
      >
        <Status label={call.status} />
        <AppointmentTools call={call} />
      </PageTitle>
      <Box className="ip-profile-grid">
        <Box className="ip-panel">
          <SectionHeader title="Appointment outcome" />
          <Box
            component="form"
            className="ip-profile-form"
            onSubmit={(event) => {
              event.preventDefault()
              updateAppointment(draft)
            }}
          >
            <Box className="ip-form-two">
              <SelectField
                label="Status"
                value={draft.status}
                options={['Scheduled', 'Completed', 'No-show', 'Cancelled']}
                onChange={(value) => setDraft({ ...draft, status: value as typeof draft.status })}
              />
              <SelectField
                label="Assigned to"
                value={draft.owner}
                options={owners.filter((o) => o !== 'Unassigned')}
                onChange={(owner) => setDraft({ ...draft, owner })}
              />
            </Box>
            <TextField
              label="Call outcome & next steps"
              minRows={4}
              multiline
              value={draft.outcome}
              onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}
            />
            {draft.status === 'Cancelled' && (
              <TextField
                label="Cancellation reason"
                required
                value={draft.cancellationReason || ''}
                onChange={(e) => setDraft({ ...draft, cancellationReason: e.target.value })}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              Changes are saved to the record. Use Send invitation or Send cancellation to notify
              the attendee; attendee emails are never sent automatically.
            </Typography>
            <Box className="ip-form-actions">
              <Button
                variant="outlined"
                disabled={!dirty || pending}
                onClick={() => setDraft(call)}
              >
                Discard changes
              </Button>
              <Button type="submit" variant="contained" disabled={!dirty || pending}>
                Save outcome
              </Button>
            </Box>
          </Box>
        </Box>
        <Box className="ip-panel ip-self-start">
          <SectionHeader title="Appointment details" />
          <Box className="ip-detail-grid is-single">
            <Box className="ip-detail-item">
              <Typography variant="caption" color="text.secondary">
                Date & time
              </Typography>
              <Typography variant="body2">
                {formatDate(call.start, timezone)} · {timeLabel(call.start, timezone)}{' '}
                {timezoneAbbreviation(call.start, timezone)}
              </Typography>
            </Box>
            <Box className="ip-detail-item">
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
              <Typography variant="body2">{call.minutes} minutes</Typography>
            </Box>
            <Box className="ip-detail-item">
              <Typography variant="caption" color="text.secondary">
                Linked application
              </Typography>
              <Button
                onClick={() => navigate('leads', call.leadId)}
                endIcon={<ArrowRight size={14} />}
              >
                {lead?.name} · {lead?.source}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}
