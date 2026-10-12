# SentinelX Day 5 — Approval-based response

## What you are learning
A detection identifies suspicious activity. Investigation checks the evidence. A response changes something to contain the suspected threat. Today the change is simulated, so you can test the workflow safely.

The workflow is: Analyst requests containment -> a different Admin reviews -> SentinelX records a simulated outcome. Rejecting a request records a decision without running the simulation.

## Key concepts
- Authorization: hiding a button is not security. The server reads the current user role and disabled state from PostgreSQL inside the transaction.
- Independent approval: the requester cannot approve or reject their own request. In the demo, request as analyst@sentinelx.local and review as admin@sentinelx.local.
- Snapshot: the target actor is copied from incident evidence when requested. Later evidence edits cannot silently retarget that request.
- Transactions: request/decision and audit writes commit together. If an audit write fails, all writes roll back.
- Concurrency: incident and request row locks serialize decisions. A partial unique index allows only one pending request per incident. Retrying a completed decision cannot run it twice.
- Audit versus history: all incident readers see response history and simulation receipts. Only Admins see the full incident audit history.

## Scope
The action is SIMULATED actor containment. Approval records a receipt with realWorldChanges=false. It does not block an IP, disable an account, alter the incident status, or call an external service. You may request again after a prior decision; each new request needs new approval. Resolved incidents require reopening before request or approval; pending requests can still be rejected.

This update implements the local approval workflow. Windmill integration and real containment connectors are not included. A real external executor would need durable jobs, retries, idempotency keys, and separately recorded failures; a database rollback cannot undo a remote action.

## Demonstration
1. Start Docker Desktop and PostgreSQL, apply migration, and start the app (START-HERE.md).
2. Run npm.cmd run simulate -- burst day5-demo in a second terminal.
3. Sign in as analyst@sentinelx.local using your existing demo password. Filter Exact actor day5-demo and open Investigate incident.
4. In Response workflow, write a reason of 10–1000 characters and request simulated containment.
5. Refresh: there must be exactly one pending request. A second request is prevented.
6. Sign out, sign in as admin@sentinelx.local, and open the same incident. Select Approve simulated containment and enter a decision note. The default selection is Reject request, so choose deliberately.
7. Confirm SIMULATION COMPLETED, open the Simulation receipt, and inspect response.requested, response.approved and response.simulated in the incident audit history.
8. Submit another request as Analyst and reject as Admin. Confirm REJECTED, with no simulation receipt for that request.
9. Sign in as Viewer. History is readable; request and decision forms are absent.
10. Request as Admin. The same Admin cannot decide it. Use an Analyst for normal demo requests.

## Day 5 completion
The update is implemented and locally validated. Your Day 5 demo is complete after the approval, rejection, Viewer and independent-review checks pass in your installation.
