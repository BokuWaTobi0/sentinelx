# SentinelX — UI upgrade for the working Day 3 project

A charcoal and lime security workspace with a responsive navigation rail, readable incident cards, real database metrics, incident search/status tabs, redesigned telemetry/admin views, and an editorial login screen with CSS orbital artwork.

## Install on Windows

Stop `npm.cmd run dev` with Ctrl+C; keep Docker running.

Extract `SentinelX-UI-Upgrade.zip`. Open the extracted folder containing `apply-ui.mjs`. Type `powershell` in File Explorer's address bar, press Enter, and run:

```powershell
node .\apply-ui.mjs E:\sentinelx
```

The installer requires Day 3, backs up replaced code, and preserves `.env`, passwords, ingestion key, existing events/alerts, database schema, and dependencies. No migration, reseeding, or npm installation is needed.

Then run one command at a time:

```powershell
cd E:\sentinelx
npm.cmd run build
npm.cmd run dev
```

Open http://localhost:3000 . Sign out if you want to see the redesigned login screen. Refresh the browser after the restart. If a command fails, stop and send the error.

## What changed

- Login: a split editorial composition, shield/orbital artwork, accessible labels, and signing-in feedback.
- Navigation: desktop rail, compact mobile navigation, current-page highlight, and role-aware admin navigation.
- Overview: four database-backed metric cards, configured rule summary, and a redesigned incident queue.
- Incidents: client-side status tabs and actor/title/rule search across the latest 100 loaded alerts. These controls do not search your full database. Counts beside tabs cover the loaded set; top metrics cover all stored alerts or last-24-hour events as labelled.
- Evidence: expandable snapshots, explicit simulated/seeded/detected labels, and investigation links.
- Status updates: pending feedback and a form remount keyed to saved status so the selector stays consistent after a successful save. Server-side RBAC remains the authority.
- Telemetry: filter controls, event-type badges, readable payload disclosures, and matching refresh control. It retains the existing five-second refresh.
- Admin: members table, clear role/account labels, and structured audit entries with metadata disclosure.
- Access denied: a styled permission explanation and working return link.
- Accessibility: focus indicators, labelled inputs, pressed/current states, decorative SVGs hidden from assistive technologies, keyboard-operable controls, and reduced-motion support.
- Responsive layouts: metric cards stack, navigation adapts, and wide event tables scroll within their panel on small screens.

No invented threat scores, live network maps, charts with fake readings, or nonfunctional export/settings buttons. Counters and incident details use your stored data. The rule summary describes configuration, not a live health check.

## Quick acceptance checks

1. Sign in using your existing demo account and password.
2. Switch incident status tabs and search for an actor; clear search to restore results.
3. As analyst/admin, change an incident status. Confirm both its status badge and dropdown show the saved value.
4. Expand evidence and use Investigate events on a detected incident.
5. Open Event stream; apply/clear filters and use Refresh events.
6. As admin, open Access & audit. Confirm the status-change record appears.
7. As viewer, verify update controls/admin navigation are absent and `/admin` still denies access.
8. Narrow the browser or use a phone-sized view. Main content should fit; event tables may scroll sideways inside the panel.

## Learn while building

| File | Concept to learn |
| --- | --- |
| src/app/globals.css | CSS variables create a consistent palette; Grid structures metric cards; Flexbox aligns controls; media queries adapt layout. |
| src/components/header.tsx | Server-rendered structure can compose a client navigation component without exposing database access. |
| src/components/navigation.tsx | `usePathname` marks the active route. Conditional rendering hides admin navigation for other roles. |
| src/components/alert-queue.tsx | `useState` controls search/tabs; `.filter()` transforms the loaded list. UI filtering does not replace authorization. |
| src/components/submit-button.tsx | `useFormStatus` reflects the parent server-action form's pending state. |
| src/app/dashboard/page.tsx | Server code queries real metrics and passes serializable ISO timestamps to a client component. |
| src/components/icon.tsx | Inline SVG creates a consistent visual system without external image downloads. |

Small learning exercise: change `--lime` in globals.css and refresh to see how a single design token affects the interface. Then inspect the `.metric-grid` media query to understand why four desktop columns become two on a phone.

## Preview and validation

`previews/` contains screenshots from an isolated local copy with synthetic fixture records. Preview numbers and account details are samples, not your database. The temporary embedded-database adapter and preview account password are not included in installed code.

See UI-VALIDATION.md for check results. This is a UI bonus after Day 3, not the planned Day 4 investigation timeline implementation.

## Restore the previous interface

The installer prints a backup-folder path. Stop the dev server, then from the update folder run:

```powershell
node .\restore-ui.mjs "E:\<backup-folder-name>" E:\sentinelx
```

Replace the placeholder with the exact printed path. This restores backed-up source files and removes newly added UI files; it does not change `.env` or database data. Restart the app afterward.
