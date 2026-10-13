# Day 10 — incident priority and live updates

## Explainable incident priority score

SentinelX assigns a deterministic **incident priority score** from 0–100 when a Day 8 detection creates an incident. The score describes review priority; it is not a probability of compromise. It is calculated only from the immutable detector evidence JSON captured in the same ingestion transaction. Analyst notes, assignment, status, and automation outcomes do not alter it.

| Factor | Points | Rule |
| --- | ---: | --- |
| Detection rule match | 20–25 | 20 for login burst and repeated IP failures; 25 for password spray and success after a burst |
| Failure volume | 0–30 | +5 for every five failures beyond the first five; capped at 30 |
| Distinct context | 0–30 | +5 per additional actor label, capped at 20, plus +5 per additional source IP, capped at 10 |
| Success after failures | 0 or 25 | +25 only for the successful-login-after-burst rule |

The total is capped at 100. Bands are **Low 0–29**, **Medium 30–59**, **High 60–79**, and **Critical 80–100**. Missing rule identity, positive integer event count, or evidence event IDs leaves an incident unscored. A diversity dimension absent from the snapshot contributes zero. The rule factor represents the matched pattern once; failure count is scored once; actor and IP breadth share one capped context factor. Success-after-failures is a distinct temporal detector fact. These choices reduce overlap, but the rubric is still a deliberately simple prioritization heuristic.

Example: five failures for one actor and one IP under `failed-login-burst-v1` score 20 (rule 20 + volume 0 + context 0) → Low. Ten failures across three actor labels for `ip-failures-across-actors-v1` score 35 (rule 20 + volume 5 + actor breadth 10) → Medium. Under `success-after-failure-burst-v1`, five failures, one actor/IP, and the following success score 50 (rule 25 + volume 0 + context 0 + success 25) → Medium. At the upper bound, the raw factors can exceed 100 and the persisted total is capped at 100.

The score does not use threat intelligence, location, reputation, or verified account identity. Actor strings are unverified labels; IPs can be shared or masked; evidence snapshots are capped at 100 event IDs by the detector. A score must never trigger containment or bypass independent Admin approval. `priority-v1` is persisted with factors and calculation time. New scoring versions apply only to newly scored incidents; existing scores are never recalculated automatically.

Migration 007 is additive. Existing incidents are intentionally unscored until the idempotent command is run. It scans at most 100,000 unscored rows per invocation and updates each only while its score remains null; insufficient evidence stays null. Run it again to process a later remainder.

## Live updates

The dashboard and incident investigation use bounded authenticated polling (no extra service or infrastructure). The client checks every 15 seconds while visible and every 60 seconds while hidden, prevents overlapping requests, aborts on navigation, and backs off to at most two minutes after failures. Each request rechecks the active session and incident/event read permissions. The response contains only a revision timestamp and whether new incidents arrived; restricted audit data is never queried or returned. A new incident shows **New incidents available** so analysts can finish reading before the list shifts. Other incident/history/job changes refresh the server-rendered view without a page reload. Refresh keeps client form state, focus, scroll, note drafts, and open details in place. Session expiry shows a sign-in link.

`priority` filter and `newest` / `priority` sort run on the server with a stable `(created_at, id)` tie-breaker and 25-row pages. Filters remain query-string based. The priority index supports score ordering; status remains an independent workflow field.

## Migration and start commands (PowerShell)

Run from `E:\sentinelx`, preserving the existing `.env` and database:

```powershell
Set-Location E:\sentinelx
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run risk:backfill
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

In another PowerShell window, run the existing local worker:

```powershell
Set-Location E:\sentinelx
$env:AUTOMATION_PROVIDER = 'local'
npm.cmd run automation:worker
```

Use `npm.cmd run risk:backfill` again if it reported the 100,000-row cap. Verification commands:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Role acceptance checks

### Viewer

1. Open the incident queue and an investigation; see the score, band, version, calculation time, and “Why this score?” factors.
2. Filter by each priority and sort by priority; visit next/previous pages and confirm stable ordering and retained filters.
3. Keep the dashboard open while another session creates an incident. Confirm the new-incident indicator appears without moving the current list. Select it to refresh.
4. Confirm Viewer cannot assign, add notes, or change status, and cannot see Admin audit details.

### Analyst

1. Change status, assignment, and add a note while the investigation remains open in another tab. Confirm it updates without a page reload and any unsaved note draft remains intact.
2. Confirm the score remains unchanged after those collaboration actions.
3. Open automation results, run/approve only through the normal workflow, and confirm job status/results update after the worker acts. Scores never authorize containment.
4. Hide the tab, wait at least one minute, then return; polling resumes and reports the latest successful check.

### Admin

1. Repeat score and live-update checks; confirm Admin audit remains visible only on its existing Admin-authorized page/section.
2. Let a session expire and confirm polling reports expiration with a sign-in link.
3. Compare an old unscored seeded incident with a detector incident before and after `risk:backfill`; insufficient evidence must remain explicitly unscored.
4. Confirm response approval remains independent from score and requires the existing distinct active Admin process.

Desktop and mobile browser checks are listed above. No browser automation/browser session is configured in this workspace, so those visual checks are manual and were not claimed as run here.
