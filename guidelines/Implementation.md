# Operational portal migration

Authorized by the request to implement the workflow audit. The v1 visual language
(dark MUI, Inter, authentic Income artwork, compact aligned shell) is preserved.
The v1 preview-only workflow freeze is superseded by persistent admin workflows.

## Delivery checklist
- [x] Restore the portal on Next.js, retaining source-native identity.
- [x] Model private operational records, access, audit history and relationships.
- [x] Connect lead lifecycle, scheduling, team invitations and webinar management
  inside Income's dashboard, not Payload's CMS panel.
- [x] Inspect existing operational records through the Payload CLI. Collections
  are empty; no customer records, test accounts, or financial history were invented.
- [x] Verify permission rules, server validation, dashboard controls and responsive UI.
- [x] **Verify production delivery**: `figma make verify-deploy` passed; the route
  table lists `/` and `/set-password` as static and operational APIs as request-time.
  Both public pages passed hydration/browser checks on the standalone production
  build, and the dashboard controls passed the isolated production-browser suite.
  Missing routes return HTTP 404.

## Route lifecycle
`/` and `/set-password` are static application shells. Their private operational
data is loaded at request time through authenticated, no-store API handlers.
`/api/portal` and `/api/portal-auth` are request-time operational endpoints.
There are no public editorial detail pages or cached private records.

The existing Figma-managed `/admin` authentication is unchanged. CMS administrators
can operate this internal portal; invited app staff use a separate Users collection
and isolated app-session cookie and cannot access Payload Admin.

Email uses Resend only when configured. Pending/failed sends never mean delivered.
Webinar room operations use administrator-supplied host/join links; the portal
does not pretend to control an external meeting provider's live streaming engine.

## Where staff work

- **Leads**: new records, bulk assignment/archive, archived records and restore.
  Profiles retain their native source IDs, explicit application links, separate
  webinar registration/attendance/follow-up fields, task completion and activity.
- **Calendar**: new appointments; reschedule/edit; cancellation with a reason;
  optional notification for an existing appointment; calendar invitation send.
  Times entered in scheduling forms are explicitly UTC. Working hours are
  Monday–Friday Eastern; collection hooks enforce host eligibility and overlaps.
- **Webinars**: create, duplicate, edit/cancel sessions; capacity/waitlist and
  registration controls; registrants; recipient-reviewed emails; replay
  publication and session activity. Provider host controls open the configured
  host console; they do not claim to start a broadcast from Payload.
- **Payments**: record review, notes/rejection reason and protected proof links.
  Administrative review does not transfer or independently verify funds.
- **Settings → Users & invitations**: invite, resend, revoke/disable, reactivate,
  and change roles. New staff accept a native Payload expiring password-setup
  link and sign into Income, never into Payload Admin.
- **Settings → Team & availability / Emails / Audit log**: scheduling hosts,
  stored hours, provider readiness, communication activity and recorded changes.

Deletion is intentionally archive-first; destructive permanent deletion is not
exposed. Existing source records and appointment history are preserved.

## Verification and remaining integration limits

```sh
pnpm test
pnpm run typecheck
pnpm run test:dashboard
pnpm run test:hydration
node tests/portal-session-browser.mjs
figma make verify-deploy
```

Browser scripts use an existing app server and headless Chromium on its debugging
port. The dashboard script uses isolated HTTP fixtures to exercise authenticated
controls without creating accounts, changing real records, or emailing people.
It separately verifies that the live private API rejects anonymous reads.
Collection tests exercise the actual hooks with isolated Local API doubles.
Actual signed-in, cross-device mutation and real email delivery still require
authorized staff credentials and the configured Resend sender; they are not
claimed as live-tested.

Latest checks: 19 unit/collection-rule tests passed; the full TypeScript check
passed; dashboard browser checks passed at 320, 390, 768 and 1280px in development
and production. Both public routes passed repeated hydration checks with no
uncaught browser exceptions.

Resend configuration remains in Make's secret storage (`RESEND_API_KEY`,
`EMAIL_FROM`), never in Payload records or browser inputs. The dashboard reports
configuration readiness and disables sends until configured.

## Session recovery

Staff sign-out catches transport failures, HTTP failures and malformed responses.
The page reloads only after the logout endpoint confirms success. A failed or
ambiguous response leaves a retry message rather than an unhandled rejection.
Pending requests cannot be submitted twice, and unsaved edits require confirmation.

CMS-authenticated users see **Manage administrator session**, which links to the
existing managed `/admin` surface; they are not shown a staff-cookie logout action.
Staff sign-out intentionally does not clear the independent CMS session.

The Figma iframe's automatic CMS sign-in timeout and its manual fallback are
platform-owned. Do not change managed routes, patch package internals, replay
callback codes, or suppress global promise errors to conceal that warning.
The session regression suite uses intercepted responses and does not exercise
real Figma SSO or modify actual accounts.

## Lead sounds and operational reminders

- [x] Add a private, recipient-owned `notification-preferences` collection and
  authenticated alert/settings endpoints. Existing collections and records are
  preserved; personal records are created only when a staff member saves settings.
- [x] Verify the registered schema and empty collection through the Payload CLI.
  No test staff accounts or customer records were seeded.
- [x] Add an incremental, paginated new-record feed, native-ID deduplication,
  reminders and calendar snapshots without refreshing editable dashboard records.
- [ ] Verify production delivery for the new alert routes and reminder controls.

### Workflow

1. Staff enable sound from the volume control or **Work reminders → Settings**.
   Web Audio creates the short local bell; no remote sound asset or third-party
   credentials are needed. A click is required by browser autoplay policies.
2. The first successful alert request establishes a baseline. Existing leads
   do not ring on login. Later record creations are detected by creation time
   and native document ID; contact details are never used to merge or deduplicate
   source records. Restoring or editing an old record is not a new-lead alert.
3. Alerts poll every 30 seconds, on focus, and after dashboard mutations. The
   incremental window uses a fixed upper watermark and pagination so creations
   during a multi-page read are not lost. Bursts are grouped and the sound has a
   short cooldown rather than ringing continuously.
4. Scheduled calls remind at the chosen 5/10/15/30-minute advance and at their
   start. This is explicitly **all workspace calls**, not an inferred “my calls”
   relationship. Cancelled/completed calls do not remind; rescheduling creates
   a new time-specific reminder identity. Calls more than two minutes past their
   start do not ring as a stale backlog.
5. Incomplete follow-up tasks appear when due. Existing overdue work stays
   visible without replaying a noisy login backlog. Completed/archived/closed
   records are excluded from the task feed. Old follow-ups do not make delayed
   sounds after a long offline period.
6. The bell opens **Alerts / Calls / Settings**, with actionable records first.
   Dismiss and five-minute snooze affect browser-local delivery state, not the
   source record. Only IDs/timestamps are stored locally; account preferences
   are saved in Payload. Web Locks coordinate duplicate sounds across tabs where
   supported, with best-effort storage fallback elsewhere.
7. Opening a record explicitly refreshes dashboard data and respects unsaved-change
   confirmation. Passive alert polling never replaces an open edit draft.

### Browser and delivery boundaries

In-app timers require Income to remain open. Sleeping devices and throttled
background tabs can delay notifications; stale snapshots stop triggering alerts.
Optional browser notifications require a secure context and explicit permission,
can be blocked by the Make iframe, and never expose contact names or email in the
OS message. They do not implement closed-browser push delivery.

For reminders after closing Income, **Download calendar event** creates a private
ICS snapshot with the user's selected advance alarm (default ten minutes), or
no alarm if personal call reminders are off. The calendar app controls delivery.
Re-download after appointment changes; this is not a two-way calendar sync.
Cancellation files do not retain an alarm. Outgoing attendee calendar invitations
also include the default ten-minute reminder without requiring staff preferences.

Personal settings save immediately and are isolated by authenticated recipient.
The existing General workspace reminder switch is the team-wide master control.
No email, SMS, background job, provider webhook, or live broadcast integration is
claimed by these browser reminders.

Verification commands:
```sh
pnpm test
pnpm run typecheck
pnpm run test:notifications
pnpm run test:dashboard
pnpm run test:hydration
figma make verify-deploy
```
The notification browser suite uses an isolated clock, AudioContext spy and HTTP
fixtures; it sends no real notifications and changes no production documents.
