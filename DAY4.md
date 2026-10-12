# SentinelX — Day 4: investigate an incident

Prerequisite: Day 3 works on your computer. This update adds investigation pages, database-backed filters, exact event inspection, and permission-aware incident audit history. It includes the shared UI components these pages use. No new dependencies, migration, reseeding, or database reset is needed.

## Windows installation

1. Stop the dev server with Ctrl+C. Keep Docker/PostgreSQL running.
2. Extract `SentinelX-Day4-Update.zip` and open the folder containing `apply-day4.mjs`.
3. Type `powershell` in that folder's File Explorer address bar and press Enter.
4. Run:

```powershell
node .\apply-day4.mjs E:\sentinelx
```

The installer backs up replaced files and preserves .env, passwords, ingestion key, users, events, alerts and migrations. It requires the Day 3 detector file. Shared UI files are included so the update also works if the previous separate UI upgrade was skipped.

Then run separately, stopping at any error:

```powershell
cd E:\sentinelx
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

All 21 tests should pass. The tests run an embedded PostgreSQL instance and do not touch your actual database.

## Your five-minute investigation demo

Keep the dev-server terminal running. In another PowerShell terminal:

```powershell
cd E:\sentinelx
npm.cmd run simulate -- burst day4-demo
```

First run for this fresh actor should create one alert from eight failures. If you already used that actor recently and cooldown suppresses the alert, use day4-demo-2.

1. Log in as admin or analyst. Open http://localhost:3000/dashboard.
2. Set Exact actor = day4-demo, Status = OPEN, Severity = HIGH, Created within = Last 24 hours. Click **Apply incident filters**.
3. Click **Investigate incident** or the incident title.
4. The incident page should show eight evidence events, sorted earliest first. Each entry shows event time, type, actor, source/IP, reason and payload disclosure.
5. Click **Open exact event** on a timeline entry. Inspect both Occurred at and Ingested at, the exact event ID and payload.
6. In Linked incidents, click the original incident to return.
7. Set its status to Acknowledged and save. The badge and dropdown should both show the saved value. Admins also see the incident's audit history; analysts/viewers do not receive that audit section.
8. Open Event stream, filter the same actor, and choose Last 24 hours or Last 7 days. Clear filters when done.

The seeded Day 1 alert has no exact event references. Its investigation page explicitly shows **No linked evidence events**. It never fabricates a timeline using other events that happen to share an actor name.

## What changed

### Incident detail: `/incidents/<alert-UUID>`

Shows alert classification, status, rule, actor, failure count, timestamps and ID; an evidence timeline; raw frozen evidence; and a link to wider actor activity. Analysts/admins can change status. Admin-only audit history displays the earliest 50 incident-specific records. Viewer accounts can inspect the evidence but cannot update status or read audit history.

The timeline uses only the UUIDs in the alert's stored evidence snapshot, not current actor search results. Missing/invalid/capped references are disclosed. Stored event-ID evidence is limited to 100 references. The detector's truncated snapshot remains visibly marked. Later ingested failures do not silently change the earlier evidence.

### Exact event detail: `/events/<event-UUID>`

Shows the event's type, actor, source/IP, occurrence time, ingestion time, ID and payload. Latest 20 linked incidents are found through exact event-ID evidence membership or the alert's event_id foreign key, rather than actor matching.

### Database-backed incident filters

Search text, exact actor, status, severity and age of alert creation are validated on the server. Filtering occurs before the newest 100 matching results are loaded. The matching count reflects all matching stored alerts. This replaces the former client-only status tabs and search across a loaded slice.

- Text search: literal, case-insensitive substring of title/rule/actor; percent and underscore are not wildcards.
- Actor: exact, case-sensitive match of evidence.actor.
- Status/severity: supported enum values only.
- Created within: all time, last 24 hours or last 7 days, based on alert.created_at.
- Metrics above the queue remain global and do not change with filter selection.

Filters appear in the URL so the result can be bookmarked or shared within the signed-in workspace. They do not grant access to someone without a session. This MVP limits displayed results to 100; it does not yet paginate older matches.

### Event time filters

Exact actor/type plus Occurred within = all/24h/7d. These use event.occurred_at, not the arrival timestamp. Event Stream counters remain global over the last 24 hours even when list filters differ. The newest 100 matching events are shown.

### APIs

- `/api/alerts?status=OPEN&severity=HIGH&actor=day4-demo&time=24h&q=login`: session and alerts:read required. Response includes alerts, limit=100 and totalMatches.
- `/api/events?actor=day4-demo&eventType=LOGIN_FAILURE&time=24h`: session and events:read required.
- Ingestion POST behavior and Day 3 detection are unchanged.
- Invalid enum/oversized/repeated known filter inputs are rejected. Page requests show an invalid-filter message; API requests return 400. Unknown record UUIDs or missing records show a record-not-found page.

## Learn while implementing

**1. Correlation is different from evidence membership.** Actor search finds activity about a person. A snapshot's UUID list identifies the specific observations used to justify one alert. Your timeline is a join from those IDs to the stored events.

**2. Filtering before LIMIT matters.** Loading 100 rows then searching can miss an older matching incident. PostgreSQL now applies WHERE first, orders matches, then limits the displayed set. `count(*) OVER()` provides the full match count in the same query.

**3. Query parameters are untrusted input.** Zod checks the allowed values and lengths. SQL parameters bind those values instead of constructing SQL from them. Together they improve correctness and resist injection.

**4. Event time differs from processing time.** occurred_at describes when activity happened. ingested_at describes when SentinelX received it. Late arrival is why your detector and timeline use occurrence time.

**5. Rendering controls is not authorization.** Server permission checks still protect page data and the status-change action. Admin audit queries are not executed for viewer/analyst roles.

**6. Dynamic routes identify a record.** `[id]/page.tsx` handles a path containing a UUID. Next.js passes params as a Promise; await it, validate the UUID, then query the record. Missing records call notFound().

Files to inspect:

| File | Purpose |
| --- | --- |
| src/lib/investigation.ts | Filter validation, parameterized queries, snapshot-ID normalization/capping |
| src/components/incident-filters.tsx | GET form that creates URL query parameters |
| src/app/dashboard/page.tsx | Server-side filtering before loading results |
| src/app/incidents/[id]/page.tsx | Exact timeline and role-gated incident view |
| src/app/events/[id]/page.tsx | Inspect one observation and its linked incidents |
| src/components/incident-status.tsx | Reusable status form with pending feedback |
| src/app/dashboard/actions.ts | Authorized mutation and refresh of overview/detail/admin data |
| scripts/investigation.test.ts | Six new filter/evidence SQL tests |

Learning exercise: run one burst, copy one event UUID from its snapshot, and compare it with the exact event page. Then inspect the SQL `WHERE id=ANY($1::uuid[])` to understand why unrelated failures are excluded.

## Acceptance checklist

- All 21 tests and build pass.
- New burst produces a detected alert; filters find it; URL contains your filters.
- Incident timeline shows its exact eight referenced events earliest first.
- Exact event page shows occurrence/arrival timestamps and links back to the incident.
- Status update persists and appears in the admin audit history.
- Viewer can read incident evidence but sees no update control or incident audit section.
- Seeded alert displays an honest empty-evidence state.
- Bad filters and invalid record paths display clear messages without a database crash.
- Event time filter works; mobile incident page fits the screen.

## Troubleshooting

- npm cannot find package.json: cd E:\sentinelx.
- Record not found: use an actual incident link; an event UUID is not an incident UUID.
- No results: clear filters; exact actor/status comparisons may exclude the record.
- No alert on repeated simulation: Day 3 cooldown may apply; use a fresh actor.
- No timeline for seeded alert: expected; use a detected alert generated by the simulator.
- No audit section as analyst/viewer: expected RBAC behavior.
- Updated status disappears from the filtered queue: expected if the selected status no longer matches; clear filters or open the incident URL.
- Empty/missing timeline references: the exact events may have been removed. The snapshot is retained and missing references are reported.

## Restore

Stop the server and use the printed backup folder:

```powershell
node .\restore-day4.mjs "E:\<printed-backup-folder>" E:\sentinelx
```

Then restart the app. Code is restored; your database data and .env are unchanged.

See DAY4-VALIDATION.md for actual verification scope. Preview screenshots use an isolated test database with synthetic records, not your database. Day 5 will add human-approved simulated response; this update does not execute containment actions.
