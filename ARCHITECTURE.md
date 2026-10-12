# SentinelX architecture and learning notes

## Components
| Component | Responsibility |
| --- | --- |
| Next.js app | Login, role checks, event API, incident investigation and decisions |
| PostgreSQL | Identity, sessions, events, snapshots, requests, queue and audit records |
| Detector | Five failures per actor in an inclusive 60-second window; overlapping-window suppression |
| Worker | Claim a leased job, call Windmill, validate result and persist outcome |
| Windmill flow | Validate immutable inputs and return snapshot investigation or simulated containment |

## Data relationships
users -> sessions; events -> alerts/evidence; alerts -> response_requests and automation_jobs; all mutations -> audit_logs. Migrations 001–004 are versioned and applied transactionally.

## Lifecycle
An ingestion transaction inserts new event IDs, runs detection, stores evidence and queues investigation. Duplicate IDs are ignored. Independent Admin approval stores a decision and queues containment in one transaction. The worker marks completion only after a valid result matches the job, incident, response and target.

## Important distinctions
Authentication identifies a user. Authorization determines what the user may do. UI visibility is only convenience: mutations enforce roles on the server.

The detector snapshot is evidence at detection time. Incident status is an investigation-tracking decision. A response approval authorizes execution. A receipt proves the simulated workflow returned a validated result. These are separate states.

A lease is temporary worker ownership, not a lock held during the network call. The token prevents an expired worker from committing over a newer claim. PostgreSQL transactions preserve local atomicity; they cannot undo an external side effect. The system provides at-least-once remote execution, not exactly-once remote actions.

## Operational assumptions
One organization, local demo identities, no real containment. Windmill tokens remain server-side. PostgreSQL runs persistently in Docker on the user's machine. The worker is a separate process. Production hosting requires HTTPS, secret management, backups, monitoring, rate-limit hardening and environment-specific operational work.
