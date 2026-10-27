# Day 11 — detection controls, log import, and notifications

## Configurable detection rules

Only an authenticated active Admin can open **Detection rules** and save settings. The server validates the role again on every save. The page explains each rule, shows current values and the existing-code defaults, and bounds every number. The supported ranges are failure/distinct-actor thresholds 2–100, event-time windows 10–3,600 seconds, and cooldowns 0–86,400 seconds. Password spray and repeated-IP rules require the distinct-actor threshold not to exceed the failure threshold. The success-after-failures lookback must cover its failure window.

The initial version 1 values preserve the existing detection behavior:

| Rule | Enabled | Thresholds | Time windows | Cooldown |
| --- | --- | --- | --- | --- |
| `failed-login-burst-v1` | yes | 5 failures | 60 seconds | 60 seconds |
| `password-spray-v1` | yes | 5 failures, 5 actor labels | 300 seconds | 300 seconds |
| `ip-failures-across-actors-v1` | yes | 10 failures, 2 actor labels | 600 seconds | 600 seconds |
| `success-after-failure-burst-v1` | yes | 5 failures | 60-second failure window, 300-second success lookback | 300 seconds |

Each real change writes an immutable configuration version and its Admin audit row in one transaction. Saves require the version displayed by the form; a stale form gets a conflict and cannot overwrite newer settings. Ingestion takes the same database advisory lock, reads one configuration snapshot, and uses that snapshot for all detections from that ingest request. Each incident records the version used. Updates affect newly ingested events only; they do not replay old events or change previous incidents, evidence, or scores.

Existing cooldown rows are retained across versions. Every new detection compares the stored trigger time using the currently configured cooldown duration. A shorter duration can allow an incident sooner; a longer duration can suppress one longer. The legacy 60-second burst-window compatibility check remains for cooldown rows written before migration 005.

## CSV/JSON event import

Analysts and Admins can use **Import logs**. Viewers cannot preview or import. Select a local file to preview accepted rows, duplicates, and row-level rejections; then confirm explicitly. Both preview and confirmation are authenticated and authorized on the server. Confirmation reparses the uploaded bytes and calls the same event validation, event-ID idempotency, detection, scoring, automation-queue, and audit pipeline as regular ingestion. Preview performs no writes and never triggers detection.

The file limit is 1 MiB and the event-row limit is 1,000. CSV supports quoted fields, escaped double quotes, and multiline quoted values. Its header must contain exactly supported names with no duplicates: `id`, `occurredAt`, `source`, `eventType`, `actor`, `sourceIp`, `payload`. Required columns are `occurredAt`, `source`, `eventType`, `actor`, and `sourceIp`; `id` and `payload` are optional. `payload` is a JSON object. Timestamps use ISO 8601 with a timezone offset, and the actual event validator accepts only the past seven days through 60 seconds ahead. JSON accepts an array of event objects or an object containing only an `events` array. Download matching examples from the import page.

Supplied event IDs are preserved. If omitted, the importer derives a stable UUID from SHA-256 of the exact file bytes plus the row position. Retrying the exact same file therefore safely deduplicates already inserted rows. Editing, reordering, or re-encoding a file changes its hash; supply IDs when retrying a modified file. Import commits in batches of at most 100 events. A later batch or audit failure can leave earlier batches committed; the UI reports that import stopped and recommends retrying the exact same file. Database event ID uniqueness and the deterministic IDs make that retry safe. Download the rejected-row report to review row number and validation reason; it does not include event payloads or secrets. Historical timestamps outside the same seven-day ingestion window are rejected; import does not bypass normal freshness validation or reprocess existing event history.

## In-app notification routing

Notifications are private to an individual active account. Listing, unread counts, read mutations, and live-update notification payloads are scoped to the current authenticated user. A role does not grant access to another account's inbox. Notifications contain only a short message and a link to an incident the account can already read. They do not grant new action permissions.

| Trigger | Recipient |
| --- | --- |
| New incident | Active Viewers receive a read-only notice. Analysts/Admins see incidents in their queue and receive notices for their own action requests below. |
| Admin assigns or reassigns an incident | The selected active Analyst receives a notice. The previous assignee is not notified by this action; unassignment has no recipient. |
| Admin requests investigation | The selected active Analyst receives an audited request. This is separate from the automatic investigation job. |
| Analyst requests simulated containment approval | Active Admins other than the requester receive a notice. The existing independent Admin approval remains required. |
| Admin approves or rejects | The requesting Analyst receives the decision if still active and still an Analyst. |
| Meaningful incident status change | Active Viewers receive a read-only status notice. Unchanged status, notes, polling, and background retries do not notify. |

Inactive or role-changed recipients are skipped at creation time. If no eligible Admin/Analyst exists, the triggering action still follows its existing behavior; no notification row is created. Notification uniqueness is enforced per recipient and dedupe key. The notification bell shows the private unread count and paginates history; marking one/all read only changes the current user's rows. It polls the authenticated Day 10 updates endpoint every 15 seconds on every workspace page, pauses while the tab is hidden, retries with bounded backoff, and fetches notices in stable cursor pages of 20 so bursts are not skipped. The first poll establishes a database-time baseline; old inbox items are not toasted. The panel exposes the connection state and a manual check action. New notices produce a subtle in-app toast. No email, Slack, or browser push messages are sent.

## Migration and local start (PowerShell)

From a PowerShell terminal in the repository:

```powershell
Set-Location E:\sentinelx
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

In another terminal, keep the existing local automation worker running:

```powershell
Set-Location E:\sentinelx
$env:AUTOMATION_PROVIDER = 'local'
npm.cmd run automation:worker
```

Migration 008 is additive and idempotent through the migration runner. Keep the existing `.env`; do not reseed or reset an existing database. Existing incidents get no invented detection configuration version or notification. Run `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build` for code verification.

## Acceptance checks by role

### Viewer

1. Open the dashboard and incident queue; confirm score/priority, status, and live update state remain available.
2. Confirm Import logs and Detection rules are absent and their APIs reject Viewer requests.
3. Open the bell, read a new incident/status notice, mark it read, then sign in as a different Viewer and confirm their inbox is separate.
4. Open a notice's incident link and confirm audit details remain inaccessible.

### Analyst

1. Import a sample CSV or JSON file, inspect accepted/duplicate/rejected counts, and confirm it. Retry the exact file and confirm event IDs prevent duplicates. Download the rejected-row report.
2. Confirm an invalid row shows a useful error and preview alone does not add events or incidents. Confirm a Viewer cannot reach preview or confirmation endpoints.
3. Submit a simulated response request and verify eligible Admins receive notices. Verify the score itself does not approve or trigger containment.
4. Receive assignment/investigation notices only in the selected Analyst's inbox; confirm adding notes does not create notifications.

### Admin

1. Open Detection rules and compare version 1 values with the existing defaults. Change a bounded threshold, save, then open a stale second form and verify its save reports a version conflict.
2. Verify a new event-triggered incident stores the current configuration version and prior incidents retain their original score, evidence, and version.
3. Disable/enable a rule or adjust its threshold and confirm the setting applies prospectively. Confirm cooldown rows remain and the current duration governs suppression.
4. Assign or request investigation for an active Analyst; confirm the request is audited and appears in that Analyst's inbox, not another Analyst's.
5. Approve/reject a response as an independent Admin and confirm the requester is notified while Admin-only audit detail remains restricted to Admin.

Desktop and mobile browser interactions should be checked with the steps above. Browser automation is not configured in this workspace, so no visual browser run is claimed.
