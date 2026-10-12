# SentinelX — Day 3: failed-login detection

Prerequisite: Day 2 is installed and working in E:\sentinelx.

This update adds one deterministic security rule: **at least five LOGIN_FAILURE events for the same actor in an inclusive 60-second event-time window** creates an OPEN, HIGH alert. It works across requests and sources/IPs. LOGIN_SUCCESS and PRIVILEGE_CHANGE do not count. Successes do not reset the failure count.

## Windows installation

1. Stop the running Next.js dev server with Ctrl+C. Keep Docker/PostgreSQL running.
2. Extract `SentinelX-Day3-Update.zip`. Open the folder containing `apply-day3.mjs`.
3. Type `powershell` in that folder's File Explorer address bar, then press Enter.
4. Run:

```powershell
node .\apply-day3.mjs E:\sentinelx
```

The installer backs up replaced files. It requires Day 2 and preserves .env, demo passwords, events, and existing alerts.

Then run **one command at a time**:

```powershell
cd E:\sentinelx
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run detect:backfill
npm.cmd run dev
```

Stop at any error. The migration is required **before** ingestion or replay. Do not reseed and do not reset Docker volumes.

Migration adds only `detection_windows` and its index, with a version entry. Existing Day 1 tables and data remain intact. Repeating migration is safe. Replay checks up to the latest 10,000 failure events within the past seven days and detects the logs you already sent on Day 2. It prints how many alerts it created. Zero on a later replay is normal.

## Demonstrate a new alert

Keep the dev-server terminal open. In a second PowerShell terminal:

```powershell
cd E:\sentinelx
npm.cmd run simulate -- burst day3-demo
```

Expected response on the first run for this new actor:

```text
Sent 8 simulated events (burst). {"accepted":8,"duplicates":0,"alertsCreated":1,"alertIds":["<generated UUID>"]}
```

Log in and open http://localhost:3000/dashboard. Refresh the page if it was already open. Find:

```text
Repeated login failures: day3-demo
HIGH · OPEN
RULE DETECTED · SIMULATED DATA
```

Expand **Evidence snapshot**. It should show:

- actor: day3-demo
- failureCount: 8
- threshold: 5
- windowSeconds: 60
- sourceIps: [192.0.2.50]
- eight event IDs, window bounds, first/last failure timestamps, and an explanation

The Day 1 seeded alert remains separate and is labelled SEEDED DEMO. Detected alerts are labelled RULE DETECTED; simulated input is labelled SIMULATED DATA.

Click **Investigate this actor's failed logins** to open the filtered Events page. This link shows all latest failures for that actor, not only the snapshot's eight IDs. The snapshot retains the precise IDs that justified the alert.

As ADMIN, check the audit trail for `alert.detected`. As ANALYST, acknowledge the alert and confirm the existing status-change audit still works. VIEWER can read evidence but cannot update status.

## Duplicate and cooldown behavior

Run the same simulation again immediately:

```powershell
npm.cmd run simulate -- burst day3-demo
```

The simulator creates fresh IDs each time, so eight more events are stored. A new alert is suppressed while its qualifying window ends within 60 seconds of an existing alert's window end for the same actor/rule. You may see `alertsCreated: 0`. If you ran the next command more than 60 seconds later, a new alert may correctly be created. For a guaranteed fresh demo without waiting, use another actor:

```powershell
npm.cmd run simulate -- burst day3-demo-2
```

There are two separate forms of deduplication:

- Retrying the **same UUIDs** creates no duplicate events or detection alerts.
- New UUIDs from the **same actor** are stored but qualifying windows within the 60-second cooldown are suppressed.

Resolving an alert does not clear its cooldown. A later separate burst beyond that event-time cooldown can create a new alert. Evidence is a frozen snapshot, not a live count of later failures. For a multi-batch burst, the first crossing may capture five failures rather than all subsequent failures.

Running `npm.cmd run detect:backfill` again does not duplicate previously covered detection windows. It can create alerts for other qualifying, previously uncovered windows. If Day 2 was simulated multiple times far apart, the first replay may legitimately create multiple alerts.

## Implementation

Ingestion now uses a single database transaction:

1. BEGIN and acquire a transaction advisory lock.
2. Insert new events, skip repeated UUIDs.
3. Write the ingestion audit record.
4. Find qualifying sliding windows affected by the inserted failure IDs.
5. Check cooldown, create an alert, store the detection window, and write `alert.detected`.
6. COMMIT; on failure, ROLLBACK all event/alert/audit/dedup writes.

The local MVP serializes ingestion and replay with one lock, taken **before event insertion**, to avoid racing threshold reads. Under PostgreSQL's default READ COMMITTED isolation, each query after waiting sees previously committed data. Migration has its own separate lock. This is intended for a low-volume single-developer demo, not high-throughput event processing.

Detection anchors use event timestamps and include the inclusive interval [end−60 seconds,end]. Out-of-order input can complete a window anchored at an already-stored later failure. Actor names are matched exactly across sources; producers must supply a consistent normalized actor identity. Account lockout/containment is not executed.

New evidence includes actor, threshold, count, window bounds, source IPs, event IDs, first/last times, explanation, and whether all underlying events were simulated. Event-ID evidence is capped at 100 IDs; `evidenceTruncated` flags larger windows. This explains a rule trigger, not proof of an attack.

## Day 3 acceptance checklist

- Migration completes with `Schema ready: 001_init, 002_detection`.
- Existing users still log in; old Day 2 events remain.
- Replay detects qualifying Day 2 logs and is safe to repeat.
- First `burst day3-demo` creates one HIGH/OPEN detected alert with eight evidence IDs.
- Immediate repeat stores events and suppresses overlapping alerts for that actor.
- A fresh actor can create a separate alert immediately.
- Admin sees `alert.detected`; analyst status changes still audit; viewer cannot mutate.
- All 15 automated tests and production build pass.

## Troubleshooting

- Relation detection_windows missing: stop the app, run `npm.cmd run db:migrate`, restart it.
- npm cannot find package.json: `cd E:\sentinelx`.
- Ingestion key errors: use the same .env as Day 2, and restart the app after any key change.
- No new alert after a repeated burst: inspect cooldown; try a fresh actor such as day3-demo-2.
- Old Day 2 events have no alert: run `npm.cmd run detect:backfill`. Ingestion deliberately detects only new events; duplicate retries do not replay historical logs.
- Backfill creates zero: no uncovered qualifying window exists in its seven-day/10,000-event horizon.
- Simulator accepted more than zero but dashboard unchanged: refresh dashboard and check it is the Day 3 code; Events auto-refreshes but dashboard does not yet.

## Files in this update

- db/migrations/002_detection.sql
- src/lib/sql-client.ts, migrations.ts, detector.ts, ingest-events.ts
- src/app/api/events/route.ts, dashboard/page.tsx, events/page.tsx
- scripts/migrate.ts, detect-backfill.ts, detector.test.ts, simulate-events.ts
- package.json and package-lock.json
- DAY3.md and DAY3-VALIDATION.md

The old Day 2 instructions describe pre-detection behavior; this document takes precedence for the updated API. `/api/events` responses now additionally include `alertsCreated` and `alertIds`.

No Kafka/RabbitMQ/AI services are needed. The next phase adds investigation timelines and richer filtering; approved simulated response follows after that.

References: https://www.postgresql.org/docs/17/explicit-locking.html and https://node-postgres.com/features/transactions .
