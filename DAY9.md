# Day 9 — Clarity, collaboration, and architecture

## What changed

SentinelX now uses a consistent high-contrast, responsive workspace design with clearer navigation and plain-language incident sections: **What happened**, **Evidence**, and **Next action**. Existing incident actions, event filters, audit details, response workflows, and role checks remain in place. The header reports the selected provider as **Local automation** or **Windmill automation**.

Analysts and Admins can assign or unassign one active Analyst, and append plain-text notes (1–2,000 trimmed characters). Assignment changes lock the incident, compare the expected previous assignee, validate the target’s current active Analyst role, and commit the incident update, collaboration event, and audit event together. A stale form gives a refresh message. Notes and collaboration events are append-only. A separate allowlisted `incident_history` table records assignment, note, status, and response request/decision events. It does not copy or expose Admin audit metadata. The existing audit view remains Admin-only.

The new **Explore SentinelX** view presents the implemented ingestion → detection → incident evidence → durable queue → human approval → selected provider sequence as a scroll-based six-step explanation. `IntersectionObserver` reveals steps progressively; if it is unavailable, all steps are shown. It does not execute jobs or control the worker. Investigation runs automatically; approval is required only for simulated containment. Local is the default provider. Windmill remains optional. All containment remains simulated and never changes real accounts, networks, or devices.

## Concepts and limits

- Assignment records collaboration ownership; it does not grant additional permissions or approve responses.
- One optional assigned Analyst is supported. Targets must be active Analyst users when assigned.
- Expected-assignee comparison detects stale forms after the incident row is locked. Assignment plus its audit event is transactional.
- Notes are append-only plain text, limited to 2,000 characters, with author and UTC timestamp. HTML is escaped by normal React text rendering.
- Collaboration history is not the Admin audit trail. Only explicitly recorded safe history fields are shown to all signed-in incident readers.
- History uses stable descending `(created_at, id)` keyset pagination, 30 entries initially and at most 50 per request.
- The explorer uses ordinary page scrolling and no motion controls. Reduced-motion settings reveal all steps immediately and disable the reveal transition.
- Keyboard and mobile users read the same ordered list of six steps. If `IntersectionObserver` is unavailable, the component reveals the full list instead of hiding any stages.
- No user or network action is performed by containment. The selected automation provider is displayed honestly.

## Migration and start commands (PowerShell)

From `E:\sentinelx`, with your existing `.env` and database:

```powershell
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

In a second PowerShell window, start the durable queue worker:

```powershell
Set-Location E:\sentinelx
npm.cmd run automation:worker
```

Keep the current `.env`; do not copy over it. Migration 006 is additive. These commands do not reset the database or seed accounts. Local mode is selected when `AUTOMATION_PROVIDER` is unset; Windmill is selected only when explicitly configured.

Run the automated checks from another terminal when desired:

```powershell
Set-Location E:\sentinelx
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

## Acceptance checklist by role

### Viewer

1. Sign in as `viewer@sentinelx.local` using the existing seeded password.
2. Open Overview, an incident, its immutable trigger evidence, later related-event timeline, collaboration history, and Explore SentinelX.
3. Confirm the selected provider label and all six architecture stages are visible.
4. Confirm assignment and note forms are absent; attempting a server mutation must still be rejected.
5. Confirm the Admin-only Access & audit navigation and page are unavailable.

### Analyst

1. Sign in as `analyst@sentinelx.local`.
2. On an incident, assign an active Analyst, reassign it, and unassign it. Confirm each action appears in Investigation history.
3. Open the incident in a second tab, change the assignment in the first tab, then submit the old form. Confirm a stale-assignment message and refresh before retrying.
4. Add a note with ordinary text and confirm author and timestamp appear. Try whitespace-only and overlong text; neither should be saved. Confirm note content is displayed as text.
5. Update incident status and request simulated containment. Confirm independent Admin approval is still required.
6. Confirm Admin audit details remain unavailable.

### Admin

1. Sign in as `admin@sentinelx.local`.
2. Repeat assignment and note checks; attempt assigning a Viewer or disabled account through a crafted request and confirm server rejection.
3. Review a response request from a different user and approve or reject it. Confirm this appears in collaboration history and Admin audit, and approved containment is simulation-only.
4. Confirm the requester cannot approve their own response, even if they are an Admin.
5. Inspect the Admin audit trail separately from Investigation history.

## Explorer and accessibility checks

1. Open **Explore SentinelX** and use normal scrolling to read all six architecture stages.
2. Use Tab/Shift+Tab through navigation and links; focus rings remain visible.
3. Enable reduced motion; all stages should remain readable without reveal transitions.
4. At a narrow/mobile viewport, confirm the ordered stages fit without horizontal overflow.
5. Disable `IntersectionObserver` in browser devtools; all steps should appear.

## Local demo verification

At desktop and mobile widths, check login, overview/incident queue, event stream and event details, incident evidence and related timeline filters, assignment and notes, response approval, Admin members/audit, and Explore SentinelX. Use keyboard-only navigation and reduced motion. This workspace has no configured browser automation tool, so these browser checks are documented manual acceptance steps rather than claimed as executed.
