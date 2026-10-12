# Day 7 validation — 11 October 2026

## Code checks
- TypeScript checks: passed.
- Automated test suite: 27 passed, 0 failed, 0 skipped in this environment.
- Final production build: passed.
- release:check and automation:check: passed against the disposable database/flow fixture.
- Installer: all 16 update files matched after applying; existing .env preserved.
- Production server: started successfully using Next.js start.

## Production browser integration
Separate headless Chromium instances for Analyst, Admin and Viewer; HTTPS proxy with a temporary local test certificate. Final run used native login cookies without injection. Initial shared-browser harness problems were resolved by isolating the test browsers.

The final run passed these checks:
- Unauthenticated dashboard redirects; API returns 401.
- Real ingestion HTTP creates one alert and suppresses duplicate event IDs.
- Production login works; exact timeline has 8 events; investigation remains queued with worker stopped.
- Actual worker command processes investigation via HTTP fixture and persists result.
- Admin approval stays awaiting Windmill until worker runs.
- Worker containment completion creates receipt and incident audit records.
- Independent Admin rejection persists without dispatching containment.
- Viewer reads results without mutation/audit controls; admin access denied; 375px layout has no page overflow.
- Exact event details link back to the correct incident.
- Sign-out revokes dashboard access.
- Database outage gives friendly sign-in and 503 API responses; app survives idle disconnects and recovers after database restart.

Desktop (1440px) and mobile (375px) screenshots are included in previews. Desktop automation/response and mobile evidence layouts were visually inspected; the mobile page-width check passed. This is a targeted layout check, not exhaustive device/accessibility testing.

## Changes made
- Read-only release:check for configuration, migration state and active demo roles.
- Database acquisition timeout (5s) and statement timeout (15s).
- Idle pool disconnect handling so a database restart does not terminate the app; logging only message/code instead of the attached client object.
- Clear unavailable sign-in feedback, API 503 responses and a page recovery boundary.
- Explicit eight-hour cookie Max-Age aligned with existing session expiry; Secure/HttpOnly/SameSite remain enabled.
- Mobile wrapping for long workflow badges and IDs.
- Replaced outdated Day 1 README; added architecture, acceptance and demo guides.

## Boundaries
Browser integration used PGlite through a local PostgreSQL-compatible socket, not the user's Docker PostgreSQL. The worker called a local HTTP fixture that executes the included Python flow code, not a live Windmill workspace. Your previously confirmed Day 6 live checks remain the external-integration evidence; run release:check and automation:check again on your installation after updating.

No real containment, real external notifications, multi-tenant deployment, concurrent PostgreSQL stress testing or exhaustive accessibility audit is claimed. No user .env or stored data was used during these tests. No database migration or runtime dependency is added by Day 7.

## Final user acceptance
Install the update, pass the documented commands and production-mode walkthrough in DAY7.md, then record the demo using DEMO.md. Use HTTPS for hosted production. This completes the planned portfolio MVP; real containment remains outside its scope.
