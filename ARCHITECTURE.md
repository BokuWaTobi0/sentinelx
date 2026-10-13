# SentinelX architecture and learning notes

## Components
| Component | Responsibility |
| --- | --- |
| Next.js app | Login, role checks, event API, incident investigation, collaboration and decisions |
| PostgreSQL | Identity, sessions, events, immutable snapshots, requests, queue and audit records |
| Detector | Four explainable event-time rules with independent group keys and cooldowns |
| Incident timeline | Immutable evidence events plus separately queried, filtered related-event pages |
| Worker | Claim a leased job, execute the selected provider, validate result and persist outcome |
| Local provider | Summarize the immutable snapshot and create simulation-only receipts without network calls |
| Windmill provider | Optional external flow, selected explicitly with `AUTOMATION_PROVIDER=windmill` |
| Incident collaboration | Active Analyst assignment, append-only notes, safe collaboration history, separate restricted audit trail |
| Architecture explorer | User-controlled CSS 3D model plus equivalent static architecture map |

## Data relationships
users -> sessions; events -> alerts/evidence; alerts -> response_requests, automation_jobs and incident_history; alerts.assigned_to references one optional active Analyst; detection_cooldowns -> alerts; mutations -> audit_logs. Migrations 001–006 are additive, versioned and applied transactionally. Collaboration history stores only explicit safe event types and is never composed from restricted Admin audit metadata.

## Lifecycle
An ingestion transaction inserts new event IDs, runs all applicable event-time detection rules, stores immutable triggering evidence and queues investigation. Duplicate IDs are ignored. An advisory transaction lock serializes detection during concurrent ingestion; cooldown keys and alert creation commit with the events. Independent Admin approval stores a decision and queues containment in one transaction. The worker validates the provider-specific result, then records completion, response receipt and audit within a transaction guarded by the lease token. Local containment additionally verifies the persisted approved request and current distinct active Admin identity; it never changes an account, network or device.

## Important distinctions
Authentication identifies a user. Authorization determines what the user may do. UI visibility is only convenience: mutations enforce roles on the server.

Analyst assignment is collaboration metadata; it does not change incident permissions or response approval. The collaboration timeline includes assignment, note, status and response decision events but not audit metadata. Admin audit records remain separately permission-gated. Notes are plain text, append-only, length-limited and rendered as text.

The detector snapshot is evidence at detection time. Investigation reads only the queued snapshot and does not re-query mutable event data. Related event pages use later database queries, exclude snapshot event IDs, require incident and event read permissions, and use stable time/ID keyset pagination. They are contextual and do not alter the snapshot. Incident status is an investigation-tracking decision. A response approval authorizes execution. A receipt proves the selected provider returned a validated result. These are separate states.

Detection rules, initial thresholds, grouping, boundaries and cooldowns are documented in DAY8.md. Actor strings are grouping labels supplied by the event producer, not verified identity claims. IP rules group by parsed source IP and omit legacy rows without an IP. A detection is a suspicious pattern, not a confirmed attack.

A lease is temporary worker ownership, not a lock held during the network call. The token prevents an expired worker from committing over a newer claim. PostgreSQL transactions preserve local atomicity; they cannot undo an external side effect. The system provides at-least-once remote execution, not exactly-once remote actions. Local automation performs no external side effects.

## Operational assumptions
One organization, local demo identities, no real containment. Windmill tokens remain server-side and are needed only for the explicitly selected Windmill provider. PostgreSQL runs persistently in Docker on the user's machine. The worker is a separate process. Production hosting requires HTTPS, secret management, backups, monitoring, rate-limit hardening and environment-specific operational work.
