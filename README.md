# SentinelX — Security operations portfolio MVP

SentinelX receives simulated security events, detects repeated login failures, explains supporting evidence, and routes independently approved simulated containment through local automation by default or Windmill when selected.

## Implemented capabilities
- Database-backed login, revocable sessions, Viewer/Analyst/Admin permissions.
- Authenticated, validated event ingestion with event-ID deduplication.
- Rule: at least five failed logins for an actor within an inclusive 60-second window. Evidence snapshots and overlapping-window suppression.
- Incident queue, filters, exact evidence timeline, event details and incident links.
- Analyst response requests and independent Admin approval/rejection.
- Durable automation queue, immutable-snapshot investigation, approved simulated containment, bounded retries and worker leases.
- Incident response history and Admin-only audit history.

Containment does not disable real accounts or block IPs. Investigation summarizes the detection snapshot; it is not external threat intelligence or AI. This is a single-organization portfolio demo, not an enterprise security deployment.

## Automation provider
`AUTOMATION_PROVIDER` accepts `local` or `windmill` and defaults to `local`. Local automation needs no Windmill credentials and makes no external requests. Set it to `windmill` to use the existing Windmill flow, with `WINDMILL_WEBHOOK_URL` and `WINDMILL_TOKEN` configured. Result receipts record `LOCAL` or `WINDMILL` accurately.

## Run an existing installation
Node >=22 and Docker Desktop with Compose are required. Start Docker Desktop before database commands. From E:\sentinelx:

```powershell
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

Leave the worker running in another terminal:

```powershell
npm.cmd run automation:worker
```

Keep your existing `.env`; do not overwrite it with `.env.example`. If unset, provider selection defaults to local. Changing `DEMO_PASSWORD` does not change previously seeded passwords. Existing database data is preserved; do not seed/reset an existing installation as an update step.

## Fresh setup
Run `npm.cmd ci`, copy `.env.example` to `.env`, set a new `DEMO_PASSWORD` (12+ characters, <=72 UTF-8 bytes), start Docker, then run `db:migrate`, `db:seed` and `ingest:setup`. Local automation requires no additional provider configuration. For Windmill, explicitly set `AUTOMATION_PROVIDER=windmill` and follow DAY6.md.

## Accounts
| Account | Role |
| --- | --- |
| viewer@sentinelx.local | Read incidents, evidence and workflow outcomes |
| analyst@sentinelx.local | Viewer abilities, status changes, requests and failed-job retries |
| admin@sentinelx.local | Analyst abilities, independent decisions, full audit history and user list |

Use your existing seeded password. The requester cannot decide their own request. At most one pending or approved-but-incomplete response exists per incident.

## Verification
```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run release:check
npm.cmd run automation:check
```

`release:check` validates the selected provider, environment format, database/schema and active role availability. `automation:check` validates the selected provider without modifying SentinelX records. DEMO.md provides local-demo steps; DAY6.md documents the optional Windmill setup.

## Recovery
- Database unavailable: start Docker Desktop, run `docker compose up -d --wait`, inspect `docker compose ps`, and confirm `DATABASE_URL`.
- Jobs queued: start `automation:worker`. Configuration changes require restarting app and worker.
- Failed workflow: inspect the sanitized code and retry the same job.
- Long-running query/connection: app connection acquisition is bounded to five seconds and statements to fifteen seconds.
- Login limit: ten attempts per account per fifteen minutes, including successful attempts.
- Stop database without deleting data: `docker compose down`. Do not add `-v`.

## Limits
No real containment, multi-tenancy, SSO/MFA, external threat intelligence, notification integrations, or tamper-proof audit storage. Remote flows may run more than once after timeouts; the included Windmill flow is side-effect-free. Database receipts prevent a stale worker from overwriting newer outcomes. Real remote actions would need connector-level idempotency and reconciliation.
