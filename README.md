# SentinelX — Security operations portfolio MVP

SentinelX receives simulated security events, detects repeated login failures, explains the supporting evidence, and routes independently approved simulated containment through Windmill.

## Implemented capabilities
- Database-backed login, revocable sessions, Viewer/Analyst/Admin permissions.
- Authenticated, validated event ingestion with event-ID deduplication.
- Rule: at least five failed logins for an actor within an inclusive 60-second window. Evidence snapshots and overlapping-window suppression.
- Incident queue, filters, exact evidence timeline, event details and incident links.
- Analyst response requests and independent Admin approval/rejection.
- Durable Windmill queue, snapshot investigation, approved simulated containment, bounded retries and worker leases.
- Incident response history and Admin-only audit history.

Containment does not disable real accounts or block IPs. Investigation summarizes the detection snapshot; it is not external threat intelligence or AI. This is a single-organization portfolio demo, not an enterprise security deployment.

## Architecture
Browser -> Next.js server actions/API -> PostgreSQL.
Detection and approval -> transactional automation queue -> Node worker -> Windmill flow -> validated result -> PostgreSQL receipt/audit.

Authentication and human approval remain in SentinelX. Windmill has no SentinelX database credentials. The worker sends the immutable job payload and validates returned identifiers, action kind and target before storing completion.

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

See DAY6.md for Windmill flow import, webhook and private-token setup. Preserve your existing .env; do not overwrite it with .env.example. Changing DEMO_PASSWORD does not change previously seeded passwords.

## Fresh setup from a full source checkout
Run npm.cmd ci, copy .env.example to .env, set a new DEMO_PASSWORD (12+ characters, <=72 UTF-8 bytes), start Docker, then run db:migrate, db:seed and ingest:setup. Configure Windmill using DAY6.md. Do not seed/reset an existing database just to install an update.

## Accounts
| Account | Role |
| --- | --- |
| viewer@sentinelx.local | Read incidents, evidence and workflow outcomes |
| analyst@sentinelx.local | Viewer abilities, status changes, requests and failed-job retries |
| admin@sentinelx.local | Analyst abilities, independent decisions, full audit history and user list |

Use your existing seeded password. The requester cannot decide their own request. At most one pending or approved-but-incomplete response exists per incident.

## Verification and production-mode demo
```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run start
```

Stop dev before start to free port 3000. Keep the worker running separately. Use localhost for the local demonstration. Hosted production requires HTTPS for Secure session cookies. A passing build alone does not verify database, login or Windmill connectivity.

release:check is read-only and validates environment format, database/schema and active role availability. automation:check runs a sample investigation through your Windmill flow without modifying SentinelX records. DAY7.md lists the final browser checks. DEMO.md provides a three-minute walkthrough; ARCHITECTURE.md explains the design and tradeoffs.

## Recovery
- Database unavailable: start Docker Desktop, run docker compose up -d --wait, inspect docker compose ps, and confirm DATABASE_URL.
- Jobs queued: start automation:worker. Configuration changes require restarting app and worker.
- Failed workflow: inspect the sanitized code, correct Windmill configuration and retry the same job.
- Long-running query/connection: app connection acquisition is bounded to five seconds and statements to fifteen seconds.
- Login limit: ten attempts per account per fifteen minutes, including successful attempts.
- Stop database without deleting data: docker compose down. Do not add -v.

## Limits
No real containment, multi-tenancy, SSO/MFA, external threat intelligence, notification integrations, or tamper-proof audit storage. Remote flows may run more than once after timeouts; the included flow is side-effect-free. Database receipts prevent a stale worker from overwriting newer outcomes. Real remote actions would need connector-level idempotency and reconciliation.

See DAY7-VALIDATION.md for what was actually checked and the remaining environment-specific verification.
