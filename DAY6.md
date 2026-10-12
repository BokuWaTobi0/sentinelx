# SentinelX Day 6 — Windmill automation

## What visibly changes
Open any incident: a new Windmill automation panel shows durable job status, attempts, errors and returned results. Newly detected incidents automatically queue an investigation report. Approving containment now means APPROVED / AWAITING WINDMILL; only a validated workflow result marks it SIMULATION COMPLETED. Existing Day 5 completed receipts are preserved.

## First: install
Stop the dev server, extract the update to a separate folder, and follow START-HERE.md. Apply migration 004 before starting the app or simulator. No new npm dependency is needed.

## Connect Windmill
Use your existing Windmill instance if available. Otherwise open https://app.windmill.dev and sign in/create your workspace. Local self-hosting is also supported: use your instance URL. This package does not create a Windmill account or deploy to your workspace automatically.

1. In Windmill's workspace home, open New, choose Flow, then Import flow. Paste the complete contents of E:\sentinelx\windmill\sentinelx.flow.json. The JSON includes both Python steps; you do not need to copy the .py files separately.
2. Save/deploy the flow under your user path, for example u/<your-username>/sentinelx_incident. Confirm both steps exist: validate and execute. Deploy it so the webhook can run it.
3. From the flow's Details/Triggers page, copy the Result/Sync webhook URL. Use the flow webhook, not a script webhook or UUID/Async endpoint. A typical URL is https://app.windmill.dev/api/w/<workspace>/jobs/run_wait_result/f/u/<username>/sentinelx_incident. If version-pinned Result/Sync is available, that is also supported.
4. Generate a token allowed to run this flow (Account settings, or a flow-specific webhook token). Use the token through the Authorization header; this package does that automatically. Keep it in .env, never NEXT_PUBLIC_ or a browser form.
5. Edit your existing E:\sentinelx\.env and append these lines once, replacing the placeholders. Preserve DATABASE_URL, INGEST_API_KEY and DEMO_PASSWORD:

```dotenv
WINDMILL_WEBHOOK_URL=https://app.windmill.dev/api/w/<workspace>/jobs/run_wait_result/f/u/<username>/sentinelx_incident
WINDMILL_TOKEN=<your-private-token>
```

Do not paste your token into chat. A webhook URL containing ?token= is rejected: remove the query and put the token in WINDMILL_TOKEN.
6. In PowerShell at E:\sentinelx run:

```powershell
npm.cmd run automation:check
```

Expected: Windmill connection and result contract verified, then a report for connection-check-demo. This executes a test flow in Windmill without changing your SentinelX database. If it fails, fix the connection before starting the worker. Stop and restart the Next.js server after changing .env.

## Run the complete demo
Keep Docker Desktop running.

Terminal 1 (web app):
```powershell
cd E:\sentinelx
npm.cmd run dev
```

Terminal 2 (worker — leave running):
```powershell
cd E:\sentinelx
npm.cmd run automation:worker
```

Terminal 3 (simulator):
```powershell
cd E:\sentinelx
npm.cmd run simulate -- burst day6-demo
```

1. Sign in as analyst@sentinelx.local with your existing password. Filter Exact actor day6-demo; open Investigate incident.
2. Refresh after the worker processes it. Windmill automation should show INVESTIGATION / SUCCEEDED and a snapshot summary plus recommendation. It is rule-based enrichment of existing evidence; it does not query external threat intelligence.
3. Request simulated containment as Analyst with a reason. Sign out and log in as admin@sentinelx.local. Approve with a decision note.
4. The response becomes APPROVED / AWAITING WINDMILL. Refresh after processing: the containment job becomes SUCCEEDED and the response becomes SIMULATION COMPLETED. Inspect the workflow result, simulation receipt and Admin-only incident audit history.
5. In Windmill's Runs page, confirm the investigation and containment runs. The returned windmillRunId helps correlate with its run history when available.
6. Sign in as Viewer: results are readable; no approval or retry forms are available.

For another demo use a new actor, e.g. day6-demo-2, to avoid the detector's existing cooldown.

## Failure demo
Stop the worker with Ctrl+C. Generate a new burst or approve a request: it stays QUEUED, not completed. Restart the worker and refresh to see completion. Missing Windmill configuration stops the worker before claiming a job, preserving the queue.

For connection failures, the worker records sanitized codes and retries transient network/5xx/408/429 failures up to five attempts, with delays of 5, 10, 20 and 40 seconds. Authentication failures, malformed responses and wrong-result identifiers fail immediately. A failed job can be retried by an Analyst or Admin after correcting configuration. A failed containment job keeps the response APPROVED, without a receipt, until the same job succeeds.

Code examples:
- NOT_CONFIGURED: fill both .env settings and restart.
- HTTP_401 / HTTP_403: check token and permissions.
- HTTP_404: check workspace/path, flow deployment and copied URL.
- INVALID_RESULT: verify you imported this flow, with both steps and the correct input transforms.
- TIMEOUT: check Windmill runs; a cold worker may exceed the 30-second request timeout. Retry only the included side-effect-free flow.
- Database/503 errors: start Docker Desktop and docker compose up -d --wait, then confirm db:migrate succeeded.

## What you are learning
Outbox: detection or approval and the queued job commit in the same database transaction. The app never needs to wait for Windmill during ingestion or approval.

Worker: a separate process claims eligible jobs, calls Windmill, validates the result, and records success or a retry. It must run alongside the web app.

Lease: a claim lasts 90 seconds. If the worker crashes, another worker can reclaim the expired job. A unique lease token prevents an old worker from overwriting a newer claim's outcome.

At-least-once execution: a network timeout can happen after Windmill has run. Retries may therefore run the remote flow more than once. Our investigation and simulated containment have no external side effects; only one successful result is committed for a job. This is not a guarantee of exactly-once execution of real remote actions.

Approval boundary: human approval stays in SentinelX, using its roles and independent review. Windmill executes only after approval has been recorded. It has no database credentials and cannot change SentinelX directly; the worker validates results. We do not add a second approval gate inside Windmill.

Trust boundary: 200 OK is insufficient. Windmill can return an execution error in a JSON response. SentinelX checks the schema, job ID, incident ID, workflow kind and approved actor/response ID before storing a completion. Tokens and raw remote error bodies are not shown in the UI.

## Scope and completion
Automated investigation uses only the immutable detection snapshot. No real IP block, account disable, email or Slack message is sent. Approval still does not resolve the incident automatically. Older incidents are not automatically backfilled with investigation jobs; simulate a fresh burst.

Code and local integration tests are complete. Your Day 6 installation is complete after automation:check succeeds, both workflow kinds finish through your Windmill instance, and the worker-stop/recovery demo works. Day 7 remains final end-to-end testing and presentation/demo preparation.

## Official references
- Flow import: https://www.windmill.dev/docs/getting_started/how_to_use_windmill
- OpenFlow specification: https://www.windmill.dev/docs/openflow
- Flow webhooks, tokens and Result/Sync: https://www.windmill.dev/docs/core_concepts/webhooks

## Restoring code
Stop the app and worker. Code restore does not revert the additive migration or discard queue/history data. Before restoring Day 5 code, complete all APPROVED response jobs through the Day 6 worker. Old code cannot process those jobs; restoring while they remain outstanding leaves them unsupported. Keep the Day 6 backup and migration files. Do not drop tables, reset the database, or delete migration history.
