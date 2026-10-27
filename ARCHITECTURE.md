# SentinelX architecture and learning notes

## Components
| Component | Responsibility |
| --- | --- |
| Next.js app | Login, role checks, event API, incident investigation, collaboration and decisions |
| PostgreSQL | Identity, sessions, events, immutable snapshots, requests, queue and audit records |
| Detector | Four explainable event-time rules with independent group keys and cooldowns |
| Detection settings | Immutable, Admin-authored rule versions; ingestion reads one locked configuration snapshot and records its version on each incident |
| Incident timeline | Immutable evidence events plus separately queried, filtered related-event pages |
| Worker | Claim a leased job, execute the selected provider, validate result and persist outcome |
| Local provider | Summarize the immutable snapshot and create simulation-only receipts without network calls; each claimed attempt stores its actual provider |
| Windmill provider | Optional external flow, selected explicitly with `AUTOMATION_PROVIDER=windmill` |
| Incident collaboration | Active Analyst assignment, append-only notes, safe collaboration history, separate restricted audit trail |
| Import | Bounded CSV/JSON preview and explicit confirmation through the ordinary event validation and idempotent detection pipeline |
| Notifications | Per-user in-app inbox, role/action routing, recipient-scoped read state, and authenticated cursor polling on every workspace page |
| Report export | JSON and vector PDF generated from a repeatable-read database snapshot; Admin-only audit section is additionally role-gated |
| Architecture explorer | Six-step scroll-based path with `IntersectionObserver`; all steps show if the API is unavailable or reduced motion is requested |

## Data relationships
users -> sessions; events -> alerts/evidence; alerts -> response_requests, automation_jobs, incident_history and notifications; alerts.assigned_to references one optional active Analyst; detection_cooldowns -> alerts; detection_config_current -> immutable detection_config_versions; mutations -> audit_logs. Migrations 001–009 are additive, versioned and applied transactionally. Collaboration history stores only explicit safe event types and is never composed from restricted Admin audit metadata. Notifications are keyed to one recipient account and a unique deduplication key.

## Lifecycle
An ingestion transaction inserts new event IDs, reads one detection configuration version under the same advisory lock, runs all applicable event-time rules, scores new incidents from their immutable evidence, routes Viewer notifications, and queues investigation. Duplicate IDs are ignored. Import preview only parses and validates; explicit confirmation reparses on the server and feeds the same ingestion pipeline in bounded batches. Independent Admin approval stores a decision, Analyst notification, and containment job in one transaction. The worker records the actual provider while claiming a job, validates its provider-specific result, then records completion, response receipt and audit within a transaction guarded by the lease token. Local containment additionally verifies the persisted approved request and current distinct active Admin identity; it never changes an account, network or device.

The notification center polls the authenticated updates API on all workspace pages, independently of dashboard/incident data refresh. Its stable `(created_at,id)` cursor reads at most 20 private notices per request and drains bursts without skipping rows. The initial cursor comes from database time so the historical inbox is not toasted. Polls pause for hidden tabs, retry with bounded backoff, and expose connection state/manual check in the inbox. Listing and read mutations still scope SQL by the current user ID.

Report export authenticates and authorizes every request, then opens a `REPEATABLE READ` transaction. The incident, score, rule version, exact evidence events, collaboration, response requests, jobs/receipts, and (for Admin only) audit details are read from that same snapshot. The report is assembled before a `incident.report_generated` audit row is inserted and committed; this records generation, not successful download. Related events are live context and are intentionally omitted. PDF text is drawn locally with built-in fonts; no remote asset or user content is executed.

## Important distinctions
Authentication identifies a user. Authorization determines what the user may do. UI visibility is only convenience: mutations enforce roles on the server.

Analyst assignment is collaboration metadata; it does not change incident permissions or response approval. The collaboration timeline includes assignment, note, status and response decision events but not audit metadata. Admin audit records remain separately permission-gated. Notes are plain text, append-only, length-limited and rendered as text.

The detector snapshot is evidence at detection time. Investigation reads only the queued snapshot and does not re-query mutable event data. Related event pages use later database queries, exclude snapshot event IDs, require incident and event read permissions, and use stable time/ID keyset pagination. They are contextual and do not alter the snapshot. Incident status is an investigation-tracking decision. A response approval authorizes execution. A receipt proves the selected provider returned a validated result. These are separate states.

Detection rules, initial thresholds, grouping, boundaries and cooldowns are documented in DAY8.md and configuration versions in DAY11.md. Incident priority scoring is a deterministic triage heuristic, never a compromise probability or action authorization; see DAY10.md. Actor strings are grouping labels supplied by the event producer, not verified identity claims. IP rules group by parsed source IP and omit legacy rows without an IP. A detection is a suspicious pattern, not a confirmed attack.

JSON imports accept an event array or an object containing only an `events` array. CSV supports quoted values and embedded newlines. Files are capped at 1 MiB/1,000 rows; omitted IDs are deterministic from the exact bytes and row position. Reports cap evidence at 100 event rows, collaboration/notes at the latest 100, response requests and automation jobs at the latest 50, and Admin audit rows at the latest 100. Missing legacy fields remain null/unavailable. Sensitive-key fields, tokens, sessions, lease tokens, raw errors and stack traces are excluded. Reports do not include related event context.

A lease is temporary worker ownership, not a lock held during the network call. The token prevents an expired worker from committing over a newer claim. PostgreSQL transactions preserve local atomicity; they cannot undo an external side effect. The system provides at-least-once remote execution, not exactly-once remote actions. Local automation performs no external side effects.

## Operational assumptions
One organization, local demo identities, no real containment. Windmill tokens remain server-side and are needed only for the explicitly selected Windmill provider. PostgreSQL runs persistently in Docker on the user's machine. The worker is a separate process. Production hosting requires HTTPS, secret management, backups, monitoring, rate-limit hardening and environment-specific operational work.
