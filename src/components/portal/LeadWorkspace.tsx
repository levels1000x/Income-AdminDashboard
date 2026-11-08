import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Divider,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Alert,
} from '@mui/material'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Filter,
  Mail,
  Phone,
  Search,
  X,
} from 'lucide-react'
import { usePortal, useUnsavedChanges } from './context'
import { LeadTools } from './AdminControls'
import {
  demoToday,
  filterLeads,
  formatDate,
  initialFilters,
  money,
  needsAttention,
  owners,
  sources,
  timeLabel,
  timezoneAbbreviation,
  exportLeads,
  type Lead,
  type LeadFilters,
} from './model'
import { EmptyState, Heading, PageTitle, RowArrow, SectionHeader, SelectField, Status } from './ui'

export function LeadList({ rows, compact = false }: { rows: Lead[]; compact?: boolean }) {
  const { navigate, preferences } = usePortal()
  const webinarOnly = rows.length > 0 && rows.every((lead) => lead.source === 'Webinar')
  return (
    <TableContainer className={`ip-lead-table ${compact ? 'is-compact' : ''}`}>
      <Table aria-label="Lead list">
        <TableHead>
          <TableRow>
            <TableCell>Lead</TableCell>
            <TableCell>{webinarOnly ? 'Webinar session' : 'Source'}</TableCell>
            <TableCell>{webinarOnly ? 'Engagement' : 'Qualification / stage'}</TableCell>
            <TableCell>Next action</TableCell>
            <TableCell>Assigned to</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((lead) => (
            <TableRow hover key={lead.id} onClick={() => navigate('leads', lead.id)}>
              <TableCell>
                <ButtonBase className="ip-lead-name" onClick={() => navigate('leads', lead.id)}>
                  <Typography className="ip-name">{lead.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lead.email}
                  </Typography>
                </ButtonBase>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{webinarOnly ? lead.session : lead.source}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {webinarOnly ? 'Eastern time' : lead.service}
                </Typography>
              </TableCell>
              <TableCell>
                <Status
                  label={
                    lead.source === 'Webinar'
                      ? (lead.operationalStatus ?? lead.attendance ?? 'Registered')
                      : lead.qualification
                  }
                  subtle={lead.qualification === 'Qualified'}
                />
                <Typography variant="caption" className="ip-cell-secondary">
                  {lead.source === 'Webinar'
                    ? `${lead.attendance} · ${lead.engagement}`
                    : lead.sales}
                </Typography>
              </TableCell>
              <TableCell className="ip-next-action-cell">
                <Typography variant="caption" className="ip-mobile-field-label">
                  Next action
                </Typography>
                <Typography variant="body2">{lead.nextAction || 'Set next action'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {lead.followUp
                    ? `${formatDate(lead.followUp, preferences.timezone)} · ${timeLabel(lead.followUp, preferences.timezone)}`
                    : 'No follow-up scheduled'}
                </Typography>
              </TableCell>
              <TableCell className="ip-owner-cell">
                <Box className="ip-owner">
                  <Box
                    className={`ip-owner-dot ${lead.owner === 'Unassigned' ? 'is-unassigned' : ''}`}
                  >
                    {lead.owner === 'Unassigned' ? '–' : lead.owner[0]}
                  </Box>
                  <Typography
                    variant="body2"
                    className={lead.owner === 'Unassigned' ? 'ip-unassigned' : undefined}
                  >
                    {lead.owner}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <RowArrow />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export function Overview() {
  const { leads, appointments, payments, navigate, openLeads, updateCalendar, preferences } =
    usePortal()
  const [view, setView] = useState('attention')
  const attention = leads.filter(needsAttention)
  const calls = appointments.filter(
    (a) => a.start.slice(0, 10) === demoToday && a.status === 'Scheduled',
  )
  const received = payments
    .filter((p) => ['Confirmed', 'Wire received'].includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0)
  const shown = (view === 'attention' ? attention : leads).slice(0, 5)
  const metrics = [
    {
      label: 'New inbound',
      value: String(leads.length),
      note: `${leads.filter((l) => l.source !== 'Webinar').length} applications · ${leads.filter((l) => l.source === 'Webinar').length} webinar`,
      tone: 'neutral',
      action: () => openLeads(),
    },
    {
      label: 'Needs attention',
      value: String(attention.length),
      note: 'Review, follow-up, or assignment',
      tone: 'attention',
      action: () => openLeads({ queue: 'attention' }),
    },
    {
      label: 'Scheduled today',
      value: String(calls.length),
      note: 'Across all team members',
      tone: 'info',
      action: () => {
        updateCalendar({
          view: 'Schedule',
          anchor: demoToday,
          owner: 'Everyone',
          status: 'Scheduled',
          query: '',
        })
        navigate('calendar')
      },
    },
    {
      label: 'Confirmed payments',
      value: money(received),
      note: 'Recorded received amounts · USD',
      tone: 'success',
      action: () => navigate('payments'),
    },
  ]
  return (
    <>
      <PageTitle
        eyebrow="Your daily workspace"
        title="A clear view. A focused day."
        description="Prioritize the right conversations and keep every opportunity moving."
      >
        <Box className="ip-date">
          <Typography variant="caption" color="text.secondary">
            Today
          </Typography>
          <Typography variant="body2">
            {new Date().toLocaleDateString('en-US', {
              timeZone: preferences.timezone,
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Typography>
        </Box>
      </PageTitle>
      <Box className="ip-metrics">
        {metrics.map((metric) => (
          <ButtonBase
            className="ip-metric"
            data-tone={metric.tone}
            key={metric.label}
            onClick={metric.action}
          >
            <Box className="ip-metric-top">
              <Typography variant="body2" color="text.secondary">
                {metric.label}
              </Typography>
              <ArrowRight size={15} />
            </Box>
            <Typography className="ip-metric-value">{metric.value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {metric.note}
            </Typography>
            <Box className="ip-metric-line" />
          </ButtonBase>
        ))}
      </Box>
      <Box className="ip-priority-banner">
        <Box className="ip-priority-symbol">
          <Filter size={18} />
        </Box>
        <Box>
          <Typography className="ip-name">Start where you can make a difference</Typography>
          <Typography variant="caption" color="text.secondary">
            {attention.filter((l) => l.qualification === 'Needs review').length} application to
            review · {attention.filter((l) => l.owner === 'Unassigned').length} leads need an owner
          </Typography>
        </Box>
        <Button
          endIcon={<ArrowRight size={15} />}
          onClick={() => openLeads({ queue: 'attention' })}
        >
          Open work queue
        </Button>
      </Box>
      <Box className="ip-work-grid">
        <Box className="ip-panel ip-work-queue">
          <SectionHeader title="Your work queue" action="All leads" onAction={() => openLeads()} />
          <Tabs value={view} onChange={(_, value) => setView(value)} className="ip-inline-tabs">
            <Tab value="attention" label={`Needs attention  ${attention.length}`} />
            <Tab value="recent" label="Recently received" />
          </Tabs>
          {shown.map((lead) => (
            <ButtonBase
              className="ip-work-row"
              data-tone={needsAttention(lead) ? 'attention' : 'neutral'}
              key={lead.id}
              onClick={() => navigate('leads', lead.id)}
            >
              <Box className="ip-work-initial">
                {lead.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')}
              </Box>
              <Box className="ip-work-copy">
                <Typography className="ip-name">{lead.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {lead.nextAction}
                </Typography>
              </Box>
              <Box className="ip-work-source">
                <Typography variant="caption">{lead.source}</Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  className={lead.owner === 'Unassigned' ? 'ip-unassigned' : undefined}
                >
                  {lead.owner}
                </Typography>
              </Box>
              <RowArrow />
            </ButtonBase>
          ))}
        </Box>
        <Box className="ip-panel ip-schedule-panel">
          <SectionHeader
            title="Today’s schedule"
            count={calls.length}
            action="Calendar"
            onAction={() => navigate('calendar')}
          />
          <Box className="ip-schedule-caption">
            <Typography variant="caption" color="text.secondary">
              THURSDAY, JUNE 18
            </Typography>
            <Typography variant="caption" color="text.secondary">
              EASTERN TIME
            </Typography>
          </Box>
          {calls.map((call, index) => {
            const lead = leads.find((l) => l.id === call.leadId)
            return (
              <ButtonBase
                className="ip-schedule-call"
                key={call.id}
                onClick={() => navigate('calendar', call.id)}
              >
                <Box className="ip-schedule-time">
                  <Typography variant="body2">{timeLabel(call.start)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {call.minutes} min
                  </Typography>
                </Box>
                <Box className={`ip-call-detail ${index === 0 ? 'is-next' : ''}`}>
                  <Box className="ip-inline">
                    <Typography className="ip-name">{lead?.name}</Typography>
                    {index === 0 && <Status label="Up next" />}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {call.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {call.owner} · {lead?.source}
                  </Typography>
                </Box>
              </ButtonBase>
            )
          })}
          <Box className="ip-schedule-bottom">
            <Box className="ip-line-icon">
              <Check size={15} />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Every call is linked to its original application.
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box className="ip-source-section">
        <SectionHeader
          title="One workspace. Every inbound source."
          action="Explore leads"
          onAction={() => openLeads()}
        />
        <Box className="ip-source-grid">
          {sources.map((source, index) => (
            <ButtonBase
              className="ip-source-card"
              data-tone={source === 'Webinar' ? 'source' : 'neutral'}
              key={source}
              onClick={() => openLeads({ source })}
            >
              <Box className="ip-source-card-top">
                <Typography className="ip-source-number">0{index + 1}</Typography>
                <ArrowRight size={15} />
              </Box>
              <Typography className="ip-name">{source}</Typography>
              <Typography variant="caption" color="text.secondary">
                {source === 'Webinar'
                  ? 'Attendance & follow-up'
                  : source === 'Credit partners'
                    ? 'Partner-specific qualification'
                    : 'Applications & qualification'}
              </Typography>
              <Box className="ip-source-card-bottom">
                <Typography variant="body2">
                  {leads.filter((l) => l.source === source).length} leads
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  View source
                </Typography>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      </Box>
    </>
  )
}

export function Leads() {
  const {
    leads,
    appointments,
    filters,
    setFilters,
    notify,
    leadPage: page,
    setLeadPage: setPage,
  } = usePortal()
  const [expanded, setExpanded] = useState(false)
  const rows = useMemo(
    () => filterLeads(leads, filters, appointments),
    [leads, filters, appointments],
  )
  const pageSize = 6
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => {
    if (page > maxPage) setPage(maxPage)
  }, [page, maxPage, setPage])
  const active =
    filters.source !== initialFilters.source ||
    filters.owner !== 'Everyone' ||
    filters.query ||
    filters.queue !== 'all'
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportLeads(rows)], { type: 'text/csv;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'income-leads.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    notify(`Exported ${rows.length} leads.`)
  }
  const views: Array<[LeadFilters['queue'], string]> = [
    ['all', 'All leads'],
    ['attention', 'Needs attention'],
    ['booked', 'Booked'],
    ['unassigned', 'Unassigned'],
  ]
  return (
    <>
      <PageTitle
        title="Leads"
        description="Every inbound source, with the context to take the right next step."
      >
        <LeadTools />
        <Button variant="outlined" startIcon={<Download size={16} />} onClick={download}>
          Export current view
        </Button>
      </PageTitle>
      <Box className="ip-source-switcher" role="group" aria-label="Inbound source">
        {['All sources', 'Applications', 'Webinar'].map((source) => (
          <Button
            key={source}
            data-tone={source === 'Webinar' ? 'source' : 'neutral'}
            aria-pressed={
              filters.source === source ||
              (source === 'Applications' &&
                sources.some((s) => s !== 'Webinar' && s === filters.source))
            }
            className={
              filters.source === source ||
              (source === 'Applications' &&
                sources.some((s) => s !== 'Webinar' && s === filters.source))
                ? 'is-selected'
                : ''
            }
            onClick={() => setFilters({ source })}
          >
            {source}
            <Box className="ip-count">
              {source === 'All sources'
                ? leads.length
                : leads.filter((l) =>
                    source === 'Webinar' ? l.source === 'Webinar' : l.source !== 'Webinar',
                  ).length}
            </Box>
          </Button>
        ))}
      </Box>
      {filters.source === 'Webinar' && (
        <Box className="ip-context-note">
          <Typography variant="body2">Webinar registrations</Typography>
          <Typography variant="caption" color="text.secondary">
            Attendance and conversation follow-up are shown here. Application qualification is not
            applied to webinar registrations.
          </Typography>
        </Box>
      )}
      <Box className="ip-lead-controls">
        <Tabs
          value={filters.queue}
          onChange={(_, queue) => setFilters({ queue })}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {views.map(([queue, label]) => (
            <Tab value={queue} label={label} key={queue} />
          ))}
        </Tabs>
        <Box className="ip-lead-toolbar">
          <TextField
            placeholder="Search name, email, company…"
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Search leads' },
            }}
          />
          <Button
            variant="outlined"
            startIcon={<Filter size={15} />}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="ip-lead-filters"
          >
            Filters{filters.owner !== 'Everyone' ? ' · 1' : ''}
          </Button>
          <Box className="ip-sort">
            <SelectField
              label="Sort"
              value={filters.sort}
              options={['Newest first', 'Oldest first', 'Name A–Z']}
              onChange={(sort) => setFilters({ sort })}
            />
          </Box>
        </Box>
        {expanded && (
          <Box className="ip-filter-fields" id="ip-lead-filters">
            <SelectField
              label="Inbound source"
              value={filters.source}
              options={['All sources', 'Applications', ...sources]}
              onChange={(source) => setFilters({ source })}
            />
            <SelectField
              label="Assigned to"
              value={filters.owner}
              options={['Everyone', ...owners]}
              onChange={(owner) => setFilters({ owner })}
            />
            <Button onClick={() => setFilters(initialFilters)} startIcon={<X size={14} />}>
              Reset filters
            </Button>
          </Box>
        )}
      </Box>
      <Box className="ip-result-line">
        <Typography variant="caption" color="text.secondary">
          {rows.length} leads
          {active ? ' matching this view' : ' across all sources'}
        </Typography>
        {active && (
          <Button size="small" onClick={() => setFilters(initialFilters)}>
            Clear view
          </Button>
        )}
      </Box>
      {rows.length ? (
        <LeadList rows={rows.slice((page - 1) * pageSize, page * pageSize)} />
      ) : (
        <EmptyState onReset={() => setFilters(initialFilters)} />
      )}
      <Box className="ip-pagination">
        <Typography variant="caption" color="text.secondary">
          {rows.length
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)}`
            : '0'}{' '}
          of {rows.length} leads
        </Typography>
        <Box className="ip-inline">
          <Button
            variant="outlined"
            disabled={page === 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <Typography variant="caption" color="text.secondary">
            {page} / {maxPage}
          </Typography>
          <Button
            variant="outlined"
            disabled={page >= maxPage}
            onClick={() => setPage(Math.min(maxPage, page + 1))}
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
  )
}

export function LeadProfile() {
  const {
    route,
    leads,
    appointments,
    navigate,
    updateLead,
    notify,
    calendar,
    preferences,
    data,
    pending,
    run,
  } = usePortal()
  const timezone = calendar.timezone || preferences.timezone
  const lead = (data?.leads || leads).find((l) => l.id === route.id)
  const [draft, setDraft] = useState(lead)
  useEffect(() => setDraft(lead), [lead])
  const dirty = Boolean(lead && draft && JSON.stringify(draft) !== JSON.stringify(lead))
  useUnsavedChanges(dirty)
  if (!lead || !draft)
    return (
      <EmptyState
        title="Lead not found"
        description="This record is not available in the preview."
      />
    )
  const linked = appointments.filter((a) => a.leadId === lead.id)
  const patch = (value: Partial<Lead>) => setDraft({ ...draft, ...value })
  if (lead.archived)
    return (
      <>
        <Button
          className="ip-back-link"
          startIcon={<ArrowLeft size={15} />}
          onClick={() => navigate('leads')}
        >
          Back to lead list
        </Button>
        <PageTitle
          eyebrow={`${lead.source} / ${lead.id}`}
          title={lead.name}
          description="Archived source-native record"
        >
          {data?.user.canManage && (
            <Button
              variant="contained"
              disabled={pending}
              onClick={() => {
                void run(
                  'archiveLead',
                  { archived: false, archiveReason: 'Restored by administrator' },
                  lead.documentId,
                  lead.updatedAt,
                )
              }}
            >
              Restore lead
            </Button>
          )}
        </PageTitle>
        <Alert severity="info">
          This record is archived. Its original identity and linked appointments are retained.
          Restore it before editing.
        </Alert>
        <Box className="ip-panel !mt-5">
          <SectionHeader title="Archived record" />
          <Box className="ip-inset">
            <Typography variant="body2">
              {lead.email} · {lead.phone}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {lead.archiveReason}
            </Typography>
            <Typography variant="body2">{lead.notes || 'No internal notes.'}</Typography>
            {linked.map((call) => (
              <Button key={call.id} onClick={() => navigate('calendar', call.id)}>
                {call.title} · {call.status}
              </Button>
            ))}
          </Box>
        </Box>
      </>
    )
  return (
    <>
      <Button
        startIcon={<ArrowLeft size={15} />}
        onClick={() => navigate('leads')}
        className="ip-back-link"
      >
        Back to lead list
      </Button>
      <PageTitle
        eyebrow={`${lead.source} / ${lead.id}`}
        title={lead.name}
        description={`${lead.company || lead.service} · Received ${formatDate(lead.received)}`}
      >
        <Status
          label={
            lead.source === 'Webinar'
              ? (lead.operationalStatus ?? lead.attendance ?? 'Registered')
              : lead.qualification
          }
        />
      </PageTitle>
      <Box className="ip-record-actions" data-dirty={dirty}>
        <Box className="ip-inline">
          <Box className="ip-save-state-dot" />
          <Typography variant="body2" role="status">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </Typography>
        </Box>
        <Box className="ip-inline">
          <Button disabled={!dirty || pending} onClick={() => setDraft(lead)}>
            Discard
          </Button>
          <Button
            type="submit"
            form="ip-lead-follow-up"
            variant="contained"
            disabled={!dirty || pending}
          >
            Save follow-up
          </Button>
          {!dirty && <LeadTools lead={lead} />}
        </Box>
      </Box>
      <Box className="ip-profile-grid">
        <Box className="ip-profile-main">
          <Box className="ip-panel">
            <SectionHeader
              title={lead.source === 'Webinar' ? 'Webinar context' : 'Application details'}
            />
            <Box className="ip-detail-grid">
              {lead.answers.map(([label, value]) => (
                <Box className="ip-detail-item" key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2">{value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Box className="ip-panel">
            <SectionHeader title="Follow-up & ownership" />
            <Box
              component="form"
              id="ip-lead-follow-up"
              className="ip-profile-form"
              onSubmit={(event) => {
                event.preventDefault()
                updateLead(draft)
              }}
            >
              <Box className="ip-form-two">
                <SelectField
                  label="Assigned to"
                  value={draft.owner}
                  options={owners}
                  onChange={(owner) => patch({ owner })}
                />
                <SelectField
                  label="Sales stage"
                  value={draft.sales}
                  options={[
                    'Not started',
                    'Conversation started',
                    'Call booked',
                    'Closed',
                    'Won',
                    'Lost',
                    'Disqualified',
                  ]}
                  onChange={(sales) => patch({ sales })}
                />
              </Box>
              {lead.source === 'Webinar' ? (
                <>
                  <SelectField
                    label="Registration status"
                    value={draft.registrationStatus || 'Registered'}
                    options={['Registered', 'Confirmed', 'Waitlisted', 'Cancelled']}
                    onChange={(registrationStatus) => patch({ registrationStatus })}
                  />
                  <Box className="ip-form-two">
                    <SelectField
                      label="Attendance"
                      value={draft.attendance || 'Not recorded'}
                      options={['Not recorded', 'Registered', 'Attended', 'No Show']}
                      onChange={(attendance) => patch({ attendance })}
                    />
                    <SelectField
                      label="Follow-up status"
                      value={draft.followUpStatus || 'Not started'}
                      options={['Not started', 'Follow-Up Needed', 'Contacted', 'Applied']}
                      onChange={(followUpStatus) => patch({ followUpStatus })}
                    />
                  </Box>
                  <TextField
                    select
                    label="Explicitly linked application"
                    value={draft.linkedApplication || ''}
                    onChange={(e) => patch({ linkedApplication: e.target.value || undefined })}
                    helperText="Creates a link only. Registrations and applications are never merged."
                  >
                    <MenuItem value="">No linked application</MenuItem>
                    {leads
                      .filter((l) => l.source !== 'Webinar' && l.documentId !== lead.documentId)
                      .map((l) => (
                        <MenuItem key={l.id} value={l.documentId}>
                          {l.name} · {l.source} · {l.id}
                        </MenuItem>
                      ))}
                  </TextField>
                  {lead.webinar && (
                    <Button variant="outlined" onClick={() => navigate('webinars', lead.webinar)}>
                      Open webinar session
                    </Button>
                  )}
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Qualification is recorded by the original application funnel. Use the sales stage,
                  ownership, and next action below to manage the review.
                </Typography>
              )}
              <TextField
                label="Next action"
                value={draft.nextAction}
                onChange={(e) => patch({ nextAction: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
              <TextField
                label="Follow-up date & time (UTC)"
                type="datetime-local"
                value={draft.followUp?.slice(0, 16) || ''}
                onChange={(e) => patch({ followUp: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControlLabel
                label="Follow-up task completed"
                control={
                  <Checkbox
                    checked={Boolean(draft.taskCompleted)}
                    onChange={(e) => patch({ taskCompleted: e.target.checked })}
                  />
                }
              />
              <TextField
                label="Internal notes"
                multiline
                minRows={3}
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                slotProps={{ htmlInput: { maxLength: 5000 } }}
              />
            </Box>
          </Box>
        </Box>
        <Box className="ip-profile-aside">
          <Box className="ip-panel">
            <SectionHeader title="Contact information" />
            <Box className="ip-contact-details">
              <Box>
                <Mail size={16} />
                <Typography variant="body2">{lead.email}</Typography>
              </Box>
              <Box>
                <Phone size={16} />
                <Typography variant="body2">{lead.phone}</Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(lead.email)
                    notify('Email copied.')
                  } catch {
                    notify('Clipboard unavailable. Select the email above to copy it.')
                  }
                }}
              >
                Copy email address
              </Button>
            </Box>
          </Box>
          <Box className="ip-panel">
            <SectionHeader title="Linked appointments" count={linked.length} />
            {linked.length ? (
              linked.map((call) => (
                <ButtonBase
                  className="ip-linked-call"
                  key={call.id}
                  onClick={() => navigate('calendar', call.id)}
                >
                  <Box>
                    <Typography className="ip-name">{call.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(call.start, timezone)} · {timeLabel(call.start, timezone)}{' '}
                      {timezoneAbbreviation(call.start, timezone)}
                    </Typography>
                  </Box>
                  <RowArrow />
                </ButtonBase>
              ))
            ) : (
              <Box className="ip-inset">
                <Typography variant="body2" color="text.secondary">
                  No source-linked appointments.
                </Typography>
              </Box>
            )}
          </Box>
          <Box className="ip-profile-note">
            <Typography variant="caption" color="text.secondary">
              Source-native record
            </Typography>
            <Typography variant="caption" color="text.secondary">
              This profile is identified by its original source and record ID. It is not merged with
              other contacts.
            </Typography>
          </Box>
          <Box className="ip-panel">
            <SectionHeader title="Record activity" />
            <Box className="ip-inset">
              {data?.activities
                .filter((item) => item.recordId === lead.documentId)
                .map((item) => (
                  <Box key={item.id}>
                    <Typography variant="body2">{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.actor} ·{' '}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.detail}
                    </Typography>
                  </Box>
                ))}
              {!data?.activities.some((item) => item.recordId === lead.documentId) && (
                <Typography variant="body2" color="text.secondary">
                  No recorded changes yet.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}
