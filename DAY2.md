# SentinelX — Day 2: security event ingestion

The running Day 1 application is your prerequisite. This update adds validated event ingestion, a local simulator, and an authenticated Events page. It uses the existing `events` and `audit_logs` tables; no migration or database reset is required. Existing demo passwords and alert status are preserved.

## Apply the update on Windows

1. Stop the dev server with Ctrl+C in its terminal.
2. Extract `SentinelX-Day2-Update.zip` using File Explorer. Open the extracted folder that contains `apply-day2.mjs`.
3. In that folder's address bar, type `powershell` and press Enter.
4. Run:

```powershell
node .\apply-day2.mjs E:\sentinelx
```

The installer copies only the files in the update's manifest and backs up replaced files to a sibling folder. It never changes `.env`, deletes database data, or copies `node_modules`/`.next`. If it fails, stop and use the reported error; the installer records completed writes in its backup folder for recovery.

Then:

```powershell
cd E:\sentinelx
npm.cmd ci
npm.cmd run ingest:setup
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Run each command separately and stop if it fails. Docker Desktop and the PostgreSQL container from Day 1 must remain running; if needed, use `docker compose up -d --wait` from E:\sentinelx. Do not reseed or replace `.env`.

`ingest:setup` generates a random 64-character hex key in your existing `.env`. It preserves a valid existing key and does not print the key. Restart the dev server after setting/changing this environment variable. This is an ingestion credential, not a login password.

Keep the first terminal running. Open a second PowerShell terminal:

```powershell
cd E:\sentinelx
npm.cmd run simulate
```

Expected result on the first run:

```text
Sent 20 simulated events (mixed). {"accepted":20,"duplicates":0}
```

Log in using your existing account and click **Events**, or open http://localhost:3000/events. The page refreshes every five seconds while the tab is visible.

Select event type **LOGIN_FAILURE** and actor **demo-target**. You should see eight simulated failed logins within 21 seconds, from IP 192.0.2.50. There are also 12 normal-scenario events, including one isolated failed login. Each run generates fresh UUIDs, so running the simulator twice deliberately adds another 20 events.

Optional modes:

```powershell
npm.cmd run simulate -- normal
npm.cmd run simulate -- burst
```

`normal` sends 12 events; `burst` sends eight failures. If the app is on another port, add `SENTINELX_URL=http://localhost:3001` to `.env` and rerun the simulator. Its destination is intentionally restricted to local addresses, and it refuses redirects to avoid forwarding the secret.

## What is implemented

- `POST /api/events`: accepts a batch of 1–100 events with a dedicated Bearer ingestion key. Browser sessions alone cannot ingest. Checks credentials before reading the body.
- `GET /api/events`: requires a logged-in user with `events:read`; VIEWER, ANALYST and ADMIN can read. The ingestion key does not grant read access.
- Events page: latest 100 matching rows, exact actor/type filters, payload details, UTC timestamps, five-second refresh, and global last-24-hour counts. Counts do not change with filters.
- Validated UUIDs, IP addresses, event types, bounded actor/source/payload fields, seven-day timestamp horizon, 60-second clock-skew allowance, and 64 KiB total-body limit, including streamed bodies.
- Parameterized bulk SQL, immutable producer UUIDs, retry deduplication, and an `events.ingested` audit entry in the same transaction. Pure duplicate retries do not add audit entries.
- Simulator marks all data `demo: true` and uses documentation-range IPs. It sends logs; it does not attempt real authentication attacks.

**Day 2 does not create new detection alerts.** The demo alert from Day 1 remains seeded. Day 3 will inspect LOGIN_FAILURE events and create an explained incident. Changing the web app's login status does not yet generate these telemetry events; they currently come from the simulator.

## Request contract

```http
POST /api/events
Authorization: Bearer <INGEST_API_KEY from .env>
Content-Type: application/json
```

```json
{
  "events": [
    {
      "id": "00000000-0000-4000-8000-000000000011",
      "occurredAt": "<current ISO-8601 timestamp, e.g. new Date().toISOString()>",
      "source": "my-agent",
      "eventType": "LOGIN_FAILURE",
      "actor": "demo-target",
      "sourceIp": "192.0.2.50",
      "payload": {
        "demo": true,
        "scenario": "login-burst",
        "hostname": "demo-workstation",
        "reason": "Invalid demo password"
      }
    }
  ]
}
```

Use a real timestamp in the payload, not the placeholder above. Allowed event types: LOGIN_SUCCESS, LOGIN_FAILURE, PRIVILEGE_CHANGE. Optional payload fields are hostname, reason, demo, and scenario (normal/login-burst). Unknown payload fields are rejected to avoid casually collecting secrets.

Success returns HTTP 201 when events were inserted, otherwise 200 for duplicates: `{"accepted":1,"duplicates":0}`. Invalid/missing ingestion key: 401; server key absent/invalid: 503; validation/JSON error: 400; body too large: 413; wrong content type: 415; database failure: 503. A batch is validated before writing. Reuse the same IDs when retrying. A reused UUID is treated as a duplicate regardless of changed payload: the first accepted event wins.

Read filters: `/api/events?actor=demo-target&eventType=LOGIN_FAILURE`. Requires the browser session cookie. Responses and filters are bounded to 100 rows.

## Day 2 acceptance checks

1. Run `npm.cmd run simulate`; confirm accepted=20 and that 20 rows appear on a fresh Day 1 database.
2. Filter actor demo-target and LOGIN_FAILURE; see eight rows from the first mixed run.
3. Log in as VIEWER, ANALYST and ADMIN; each can read Events. Viewer still cannot update alerts or open Admin.
4. Log in as ADMIN; verify `events.ingested` appears in the audit trail with accepted=20.
5. Sign out and visit `/events`; it must require login.
6. Run `curl.exe -i http://localhost:3000/api/events` from PowerShell without cookies; expect 401.
7. Run `curl.exe -i -X POST http://localhost:3000/api/events -H "Content-Type: application/json" -d "{}"` without a key; expect 401 after setup.
8. Run typecheck, test and build as shown above.

For a clean Day 1 database, global last-24-hour counters should be 20 events, 9 failed logins and 5 distinct actors after one mixed run. Filters do not alter global counters.

## Troubleshooting

- npm cannot find package.json: `cd E:\sentinelx` first.
- npm.ps1 blocked: use `npm.cmd`, as above.
- "Run ingest:setup first": run `npm.cmd run ingest:setup` from E:\sentinelx.
- 503 "Ingestion key is not configured": restart Next.js after setup; verify there is exactly one INGEST_API_KEY entry in `.env`.
- 401 from simulator: both app and simulator must load the same `.env`; restart the app after changing the key.
- Connection refused: leave the dev-server terminal open; ensure it is using port 3000 or set SENTINELX_URL.
- Failed timestamp check: check the Windows clock. Simulator timestamps are generated from that clock.
- Database failure: check PostgreSQL is running and Day 1 migration has completed.
- Blank Events page: sign in, clear filters, then run simulator and refresh.

This remains a localhost, single-organization MVP. The ingestion key is shared by local demo producers; add per-agent credentials, ingress rate limits, retention and rotation before public deployment. The API is not a public anonymous log receiver.

## Files changed/added

- package.json / package-lock.json: setup/simulator/test commands and an embedded PostgreSQL dev-test dependency.
- src/lib/rbac.ts / scripts/rbac.test.ts: events:read permission and updated role matrix.
- src/components/header.tsx / src/app/globals.css: Events navigation and page styling.
- src/lib/event-schema.ts / ingest-http.ts / event-sql.ts: validation, bounded JSON, key checking and parameterized queries.
- src/app/api/events/route.ts / src/app/events/page.tsx / src/components/event-refresh.tsx: API, page and refresh component.
- scripts/setup-ingest.ts / simulate-events.ts / events.test.ts / events.sql.test.ts: setup, simulation and tests.
- .env.example: documents ingestion variables; does not modify .env.
- DAY2.md / DAY2-VALIDATION.md: update instructions and actual validation scope.

Official guidance: https://nextjs.org/docs/app/guides/authentication and https://nextjs.org/docs/app/getting-started/route-handlers .
