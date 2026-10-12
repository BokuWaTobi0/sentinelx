# Three-minute SentinelX demo

Prepare app, worker, database and Windmill before recording. Use separate browser profiles for Analyst and Admin to avoid repeated logins. Use a fresh actor such as portfolio-demo-1.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:20 | Dashboard | SentinelX connects telemetry, evidence and approved response. This is a simulated security scenario. |
| 0:20–0:45 | Run simulate burst; filter actor | Eight failed logins trigger the deterministic five-in-sixty-seconds rule. |
| 0:45–1:15 | Evidence timeline; exact event | Each evidence entry points to a stored event. The snapshot explains why detection fired. |
| 1:15–1:40 | Windmill investigation result | A durable worker dispatches snapshot review to Windmill and validates the result. |
| 1:40–2:15 | Analyst request; Admin approval | Request and approval are separate roles. Approval is recorded before execution, not treated as success. |
| 2:15–2:40 | Receipt and audit history | Windmill returns simulated containment; SentinelX saves the receipt and audit atomically. |
| 2:40–3:00 | Viewer role or queued-job recovery | Role checks run on the server. The queue survives worker downtime. No real IP or account was changed. |

## Portfolio description
Built SentinelX, a security operations MVP using Next.js, TypeScript, PostgreSQL and Windmill. Implemented authenticated event ingestion, explainable login-burst detection, evidence-based investigation, independent approval and durable workflow execution with retries and audit history.

## Questions to practise
- Why use a deterministic rule? It is explainable, testable and sufficient for this demonstration.
- Why a queue? A database commit can preserve the intent to run work even when Windmill or the worker is down.
- Why separate approved from completed? Authorization is a human decision; execution may fail or occur later.
- Why exact event IDs? A shared actor name alone does not prove which events caused a detection.
- Can retries execute twice remotely? Yes. This flow has no external side effects; real connectors need idempotency and reconciliation.
- Is the audit immutable? No. It is transactional application history, not tamper-proof storage.
