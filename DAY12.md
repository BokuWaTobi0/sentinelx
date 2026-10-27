# Day 12 — authorized investigation reports and integration verification

## PDF and JSON reports

Investigation pages offer **Export PDF** and **Export JSON**. Each request independently checks the signed-in user and the same `alerts:read` plus `events:read` permissions required by the investigation page. Viewer, Analyst, and Admin exports include the same nonrestricted report fields. Only Admin exports include the Admin-only audit section. The PDF is generated locally as a vector document with built-in fonts; no remote assets, browser rendering, HTML interpretation, or user-script execution is used. JSON is the structured, lossless representation for printable strings that a built-in PDF font cannot display.

The route opens a PostgreSQL `REPEATABLE READ` transaction before loading report data. Incident status/creation, the immutable detector evidence, exact referenced trigger event rows, priority factors/version, configuration version, assignment, collaboration notes/history, response requests and decisions, automation outcomes/receipts, and (for Admins) restricted audit entries share one snapshot. The report's `asOf` timestamp is the transaction timestamp. After successful report generation, `incident.report_generated` is written in that transaction with format and truncation flags. It means the report was generated; it does not claim that the browser finished downloading it.

The report clearly labels the immutable trigger snapshot and exact event rows. Related events are explicitly marked as omitted live context so they cannot be confused with triggering evidence. The report states that containment is simulated and no real account, network, or device action occurred. Older records with missing score/configuration version remain `null`/unavailable; the exporter does not reconstruct them.

Limits per report:

- At most 100 exact trigger event rows. It reports missing referenced rows, invalid IDs, detector-capped evidence, or omitted references.
- The most recent 100 collaboration/history entries, including notes with author and timestamp; older entries set `truncated: true`.
- The most recent 50 response requests and 50 automation jobs.
- Admin-only audit details: most recent 100 entries, only for an Admin session.
- Notes and event payload fields are rendered as inert text. Credential-, token-, session-, lease-token-, raw-error-, and stack-like fields are omitted. Internal worker errors are summarized without the raw code or stack.

PDF tables repeat headings across page breaks, wrap cell content, and include page numbers. Non-Western glyphs may not be available in built-in PDF fonts; the corresponding JSON preserves the full text. A PDF render/conversion utility and browser automation are not available in this environment, so visual PDF inspection and browser layout checks remain manual acceptance work.

## Verified implementation and workflow

Day 8–11 checks against this checkout found the four event-time rules, immutable evidence timeline, related-event separation, scoring/version persistence, Day 10 polling, rule configuration, import pipeline, per-user notifications, independent Admin response approval, durable queue, provider selection, and static architecture fallback present. The explorer is a scroll-revealed six-step list (not a 3D model); its docs now match that implementation. Day 12 adds persistence of the provider chosen on each claimed worker attempt so exports do not infer provider from current environment configuration.

An isolated PGlite integration test covers: JSON import with omitted IDs → deterministic retry/duplicate counts → burst detection and priority score → configuration version → assignment/investigation request/note → separate Admin approval → Local investigation and containment jobs → simulation receipt → notification routing → report data. It also checks evidence remains unchanged. Other automated tests cover old/truncated report data, redaction, Admin-only audit content, safe PDF text escaping, migration version, Day 9 collaboration/approval and Day 10 polling/score behavior.

## Schema migration and local start (PowerShell)

For an existing local installation, preserve the current `.env` and data. Migration 009 is additive and stores `automation_jobs.provider` for the most recent claimed attempt; old jobs remain null and display the provider as unavailable unless a validated result already records it.

```powershell
Set-Location E:\sentinelx
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

Run the worker in another PowerShell terminal:

```powershell
Set-Location E:\sentinelx
$env:AUTOMATION_PROVIDER = 'local'
npm.cmd run automation:worker
```

For a fresh disposable installation only, configure `.env` from placeholders in `.env.example`, then run `npm.cmd run db:migrate`, `npm.cmd run db:seed`, and `npm.cmd run ingest:setup`. Do not seed an existing installation as an update step. Windmill remains optional and requires credentials only when explicitly selected.

Automated checks:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Acceptance checklist

### Viewer

1. Export PDF and JSON from an incident. Confirm the report includes only readable incident data and explicitly excludes Admin audit metadata.
2. Try the import and rule-management routes, assignment/note actions, and response decisions; each must remain denied server-side.
3. Mark one notification read; sign in as a second Viewer and confirm unread count and read state are private to each user.
4. Confirm long labels and payloads wrap and that report/incident pages have no horizontal overflow on a narrow screen.

### Analyst

1. Preview an event file and verify the database does not change. Confirm it, repeat the exact bytes, and verify events/alerts/notifications do not duplicate.
2. Review detector evidence, score factors, detection configuration version, assignment, notes, request, decision, actual provider and receipt in both exports.
3. Confirm export remains available for older unscored incidents and reports missing versions honestly.
4. Request simulated containment, then confirm no job runs until an independent Admin approval is recorded.

### Admin

1. Change a bounded detection setting; verify version/audit write together, stale versions conflict, and old incident evidence/scores/configuration versions remain unchanged.
2. Export JSON and PDF; confirm the Admin-restricted audit section appears only here and is capped at 100 entries.
3. Approve or reject another user's request. Verify the requester gets a private notification and approved receipt records actual `LOCAL` or `WINDMILL` provider.
4. Stop the worker with a queued job, restart it, and confirm the lease/queue completes without bypassing approval or overwriting a newer worker receipt.

### Manual desktop/mobile and accessibility checks

1. At desktop and narrow mobile widths, inspect dashboard filters, import preview/error states, incident notes/action rail, notification panel/toast, and PDF/JSON buttons.
2. Use keyboard-only navigation. Confirm visible focus, accessible notification names/count, no toast focus theft, and reduced-motion settings keep architecture steps readable.
3. Test expired sessions and invalid import/report parameters. Confirm a clear sign-in/error message with no raw secrets or worker stack.
4. Open an export in a PDF viewer and inspect page breaks, repeated table headings, long wrapped values, and page numbers.

The unit/integration tests and typecheck/build are automated. Browser/mobile, keyboard/reduced-motion, live session expiry, worker stop/restart in a running app, and visual PDF inspection are manual checks; they must not be represented as run until someone performs them.
