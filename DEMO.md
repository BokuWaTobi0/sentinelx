# Three-minute SentinelX demo (local automation)

Use the local provider by default; no Windmill account or credentials are needed. Keep the app and worker running, and use separate browser profiles for Analyst and Admin. Use a fresh actor such as portfolio-demo-1.

Start Docker Desktop, then in the project directory run these commands in order:

```powershell
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
```

Terminal 1:

```powershell
npm.cmd run dev
```

Terminal 2:

```powershell
npm.cmd run automation:worker
```

Optional explicit local setting (default when unset):

```powershell
$env:AUTOMATION_PROVIDER = 'local'
```

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:20 | Dashboard | SentinelX connects telemetry, evidence and approved response. This is a simulated security scenario. |
| 0:20–0:45 | Run simulate burst; filter actor | Eight failed logins trigger the deterministic five-in-sixty-seconds rule. |
| 0:45–1:15 | Evidence timeline; exact event | Each evidence entry points to a stored event. The snapshot explains why detection fired. |
| 1:15–1:40 | Local automation investigation result | The durable worker summarizes the immutable detection snapshot and records a `LOCAL` result. |
| 1:40–2:15 | Analyst request; Admin approval | Request and approval are separate roles. Approval is recorded before simulated execution. |
| 2:15–2:40 | Receipt and audit history | Local automation records simulated containment; SentinelX saves the receipt and audit atomically. |
| 2:40–3:00 | Viewer role or queued-job recovery | Role checks run on the server. The queue survives worker downtime. No real IP or account was changed. |

## Optional Windmill mode
Set `AUTOMATION_PROVIDER=windmill` in `.env`, configure `WINDMILL_WEBHOOK_URL` and `WINDMILL_TOKEN`, restart app and worker, and follow DAY6.md to import/deploy the flow.

## Portfolio description
Built SentinelX, a security operations MVP using Next.js, TypeScript and PostgreSQL, with optional Windmill integration. Implemented authenticated event ingestion, explainable login-burst detection, evidence-based investigation, independent approval and durable workflow execution with retries and audit history.
