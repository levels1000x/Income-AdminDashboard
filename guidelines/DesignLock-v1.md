# Income admin — implementation lock v1

This freezes the current interactive **session-only preview**, not a production
backend. It does not connect accounts, payments, messages, scheduling, or durable
storage. Refreshing resets sample edits.

## Source of truth

- `src/app/portal/ui.tsx`: dark MUI theme, Inter scale, control defaults, semantic
  tones, shared headings, chips and empty states.
- `src/app/portal/workspace.css`: compact shell, sidebar alignment, count badges,
  tables/cards, profile save bar and responsive rules. Preserve its existing
  breakpoints (320px tested minimum; drawer below 768px; 1600px content cap).
- `src/assets/income-wordmark-light.svg`: authentic supplied artwork, including
  the cropped initial in collapsed navigation. Never redraw or substitute a logo.
- `src/styles/fonts.css`: bundled Inter 400/500/600/700 under the included OFL.
  System UI / sans-serif remains the fallback if local fonts fail.
- Existing MUI primitives and Lucide icons are the approved building blocks.

## Invariants

- Preserve Overview, Leads, Calendar, Payments and Settings, in that order.
- Retain source/queue filters, native record IDs, source-aware profiles, search,
  exports, date/timezone selection, session edits and unsaved-change protection.
- Webinar registrations are not applications. Never infer joins or merge records
  from a name, email address or phone number; use explicit source-native IDs.
- Colors convey semantics: neutral / success / attention / info / source / danger.
  Keep visible status text; never rely on color alone. Keep count badges legible.
- Preserve compact spacing and shared sidebar icon, label and count alignment;
  restrained branding; mobile card reflow; keyboard focus and reduced motion.
- Do not introduce remote imagery, decorative illustrations, extra component
  libraries, arbitrary colors, a light theme or new typography.

## Fallback inventory and behavior

| Condition | Local fallback | Recovery |
| --- | --- | --- |
| Wordmark request fails | Exact SVG embedded as a data URI, then readable Income text if blocked | No network retry loop; sidebar crop and footer footprint retained |
| External font service unavailable | No external service is required; four local Inter faces | System font stack if local requests fail |
| Lazy page is pending | MUI skeleton and announced loading copy | Page replaces skeleton when module resolves |
| Page render or lazy import fails | Page error panel inside existing navigation shell | Try again for render faults; Overview to leave the failed page; explicit confirmed reload for stale/missing chunks |
| Workspace render fails | App-level themed error panel | Explicit confirmed reload |
| Browser offline | MUI warning above content | Automatically disappears on `online`; never claims edits have synced |
| Filter has no results / record missing | Existing shared empty states | Existing reset/back controls |
| No profile image / recording / proof service | Existing initials and explicit preview disclosures | No fabricated production assets or records |

Recovery panels never expose exception messages, record data or stack traces.
No auto-reload: reloading discards session-only changes. React boundaries cover
render/lifecycle/module errors, not arbitrary asynchronous or event-handler errors.
This is not an offline-first app; only already loaded code can work offline.

## Enforcement and verification

`pnpm run build` checks the SHA-256 lock **before** the existing Vite build.
`pnpm run check:design` checks it directly. The manifest covers the application
entry points, the entire portal (including workflow model and context), all
styles, local fonts, license and artwork. Changes, additions and deletions fail.
It is a review guardrail, not a security boundary against someone editing the guard.

Run:

```sh
pnpm run check:design
pnpm test
pnpm run typecheck
pnpm run build
```

Browser regression suite (requires existing Vite server and headless Chromium
with a debugging port; never start a second Vite server):

```sh
PORTAL_TEST_URL=http://localhost:3000 CHROME_DEBUG_URL=http://localhost:9222 node tests/portal-browser.mjs
PORTAL_TEST_URL=http://localhost:3000 CHROME_DEBUG_URL=http://localhost:9222 node tests/portal-fallback-browser.mjs
```

The first suite checks workflows and responsive layout at 14 widths from
320–1920px. The second exercises asset failures, offline recovery, and both
error-boundary scopes. Keep this verification with the implementation handoff.

## Changing the frozen design

1. Obtain explicit approval for the requested deviation. Do not update a
   fingerprint simply to silence a build failure.
2. Change only approved files and record the rationale in this document.
3. Run type, model and browser checks; inspect desktop/mobile screenshots.
4. Update only the affected SHA-256 entries in
   `guidelines/portal-design-lock.json` (and its version if the contract changes).
   Use Node `createHash("sha256")` against the actual file bytes.
5. Run all four commands above, review the manifest changes and commit together.

There is deliberately no automatic “accept current design” build flag.
