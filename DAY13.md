# Day 13 — Viewer to Analyst escalation

## Responsibilities and lifecycle

Viewers can read incidents and create one Analyst escalation for an incident they can access. They cannot edit evidence, official scores, notes, incident status, rules, assignments, automation, or response decisions. Analysts can acknowledge and start escalations assigned to them, then complete the review with a plain text conclusion. Analysts continue to use existing notes, evidence, assignment controls, and simulated containment requests; an Admin must independently approve containment. Admins retain existing configuration, audit, assignment, and approval authority and can perform escalation lifecycle actions.

The lifecycle is `PENDING → ACKNOWLEDGED → IN_PROGRESS → COMPLETED`. Transitions are sequential and server checked. The existing workflow has no justified cancellation path, so cancellation is unavailable. Reassignment follows the existing incident assignment permission and is audited; the new Analyst and requesting Viewer receive private notices.

## Score separation

The system priority score is generated from incident evidence by the official scoring service. Escalation stores its score and scoring version as a point-in-time snapshot. A Viewer may separately select LOW, MEDIUM, HIGH, or CRITICAL as an assessment. That assessment never changes the official score.

## Permission and notification routing

| Action | Viewer | Analyst | Admin | Notification |
|---|---|---|---|---|
| Create escalation | Yes, for readable incident | No | No | Target Analyst |
| Acknowledge / start / complete | No | Assigned Analyst | Yes | Requesting Viewer |
| Reassign active escalation | No | Existing assignment permission | Existing assignment permission | New Analyst and Viewer |
| Containment decision | No | Request only | Independent approval or rejection | Existing response routing |
| Read private notifications | Own account only | Own account only | Own account only | Never grants incident access |

## Migration and startup (PowerShell)

The migration is additive and preserves existing records. Run it in an existing installation without reseeding:

```powershell
Set-Location E:\sentinelx
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run dev
```

Run tests and production checks:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run release:check
```

## Acceptance checklist

### Viewer

- Confirm a Viewer sees only active Analysts in the selector and sees the official score clearly separated from the optional assessment.
- Create an escalation with a useful reason. Verify current assignment routing, duplicate conflict feedback, private progress updates, and safe completion summary.
- Confirm a second Viewer cannot see that escalation or its notification, and cannot use other mutation features.

### Analyst

- Confirm the new personal notification opens the incident. Acknowledge, start, and complete in order; verify out-of-order, wrong-assignee, and short-conclusion requests are rejected.
- Review reason, assessment, score snapshot/version, and timestamps. Continue with existing evidence, notes, and containment request controls.
- Use the Analyst dashboard links to filter incidents with escalations awaiting acknowledgement or investigation.

### Admin

- Review incident collaboration history and restricted audit records separately.
- Change assignment and verify escalation history plus private notices to the newly assigned Analyst and requesting Viewer.
- Confirm simulated containment still requires a separate Admin approval and escalation alone queues no automation.

## Known limitations

Browser automation is not configured in this environment. Verify desktop/mobile layout, keyboard navigation, reduced motion, and live notification toasts manually. Escalation cancellation is intentionally unavailable because no existing workflow provides a justified cancellation permission or condition. The current schema keeps completed escalations as history and permits a later new escalation.
