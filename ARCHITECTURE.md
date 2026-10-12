# SentinelX architecture and learning notes

## Components
| Component | Responsibility |
| --- | --- |
| Next.js app | Login, role checks, event API, incident investigation and decisions |
| PostgreSQL | Identity, sessions, events, immutable snapshots, requests, queue and audit records |
| Detector | Five failures per actor in an inclusive 60-second window; overlapping-window suppression |
| Worker | Claim a leased job, execute the selected provider, validate result and persist outcome |
| Local provider | Summarize the immutable snapshot and create simulation-only receipts without network calls |
| Windmill provider | Optional external flow, selected explicitly with `AUTOMATION_PROVIDER=windmill` |

## Data relationships
users -> sessions; events -> alerts/evidence; alerts -> response_requests and automation_jobs; all mutations -> audit_logs. Migrations 001–004 are versioned and applied transactionally.

## Lifecycle
An ingestion transaction inserts new event IDs, runs detection, stores evidence and queues investigation. Duplicate IDs are ignored. Independent Admin approval stores a decision and queues containment in one transaction. The worker validates the provider-specific result, then records completion, response receipt and audit within a transaction guarded by the lease token. Local containment additionally requires an approved payload with distinct requester and Admin identities; it never changes an account, network or device.

## Important distinctions
Authentication identifies a user. Authorization determines what the user may do. UI visibility is only convenience: mutations enforce roles on the server.

The detector snapshot is evidence at detection time. Investigation reads only the queued snapshot and does not re-query mutable event data. Incident status is an investigation-tracking decision. A response approval authorizes execution. A receipt proves the selected provider returned a validated result. These are separate states.

A lease is temporary worker ownership, not a lock held during the network call. The token prevents an expired worker from committing over a newer claim. PostgreSQL transactions preserve local atomicity; they cannot undo an external side effect. The system provides at-least-once remote execution, not exactly-once remote actions. Local automation performs no external side effects.

## Operational assumptions
One organization, local demo identities, no real containment. Windmill tokens remain server-side and are needed only for the explicitly selected Windmill provider. PostgreSQL runs persistently in Docker on the user's machine. The worker is a separate process. Production hosting requires HTTPS, secret management, backups, monitoring, rate-limit hardening and environment-specific operational work.
