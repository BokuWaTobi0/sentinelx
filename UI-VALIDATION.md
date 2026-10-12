# UI verification

Passed:
- TypeScript checking and production build.
- Existing 15 detection, migration, ingestion and permission tests.
- Chromium browser checks in a separate copy using an embedded PostgreSQL fixture adapter: login/logout, status tabs, incident search, evidence expansion, server-action status update, selector/badge consistency after save, matching audit entry, viewer controls hidden, and server-side denial of /admin for viewer.
- Login, overview and event-stream screenshots at desktop (1440px) and mobile (390px); main-document overflow checks passed. Wide telemetry tables scroll within their panel.
- UI installer copied all listed files in a temporary Day 3 project and preserved .env/backend files; executed on Linux, with Windows paths to verify using the provided install step.
- Visual inspection of desktop overview/login and mobile overview/telemetry.

Browser checks used sample records and the existing app/server actions with a temporary embedded-database adapter. That adapter and its fixture accounts are not part of the installed update. Real Windows/PostgreSQL verification remains the acceptance checklist in UI-UPGRADE.md. No database migrations, dependency changes, or authentication/detection changes are included.

Search/status tabs filter the latest 100 loaded alerts. The top metrics are database-wide for incidents and last 24 hours for event counts, as labelled. The preview screenshots show sample data and are not readings from your database.
