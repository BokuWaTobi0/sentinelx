# Five-minute SentinelX walkthrough

This walkthrough uses local test data, the local provider, and the existing seeded Viewer/Analyst/Admin accounts. It does not reset or reseed an existing database and performs no real containment.

## Prepare

Keep the current `.env`. Local provider is the default and needs no Windmill credentials. Start the local database, then apply additive migrations:

```powershell
Set-Location E:\sentinelx
docker compose up -d --wait
npm.cmd run db:migrate
```

Start the app in Terminal 1:

```powershell
npm.cmd run dev
```

Start the local worker in Terminal 2:

```powershell
$env:AUTOMATION_PROVIDER = 'local'
npm.cmd run automation:worker
```

Create an isolated six-event JSON burst for import in another terminal. It uses a fresh actor label and documentation-only IP address:

```powershell
$actor = "day12-demo-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$start = [DateTime]::UtcNow.AddSeconds(-20)
$events = 1..6 | ForEach-Object {
  [ordered]@{
    occurredAt = $start.AddSeconds(($_ - 1) * 2).ToString('o')
    source = 'sentinelx-day12-demo'
    eventType = 'LOGIN_FAILURE'
    actor = $actor
    sourceIp = '192.0.2.88'
    payload = @{ reason = 'Controlled local demo event' }
  }
}
$importFile = Join-Path $env:TEMP 'sentinelx-day12-demo.json'
@{ events = $events } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $importFile -Encoding utf8
Write-Host "Import this file: $importFile"
Write-Host "Filter for actor: $actor"
```

## Walkthrough (about five minutes)

1. **0:00–0:40 — Roles and dashboard.** Open `http://localhost:3000`. Use existing seeded accounts in separate browser profiles. Confirm Viewer is read-only and each account has its own notification inbox.
2. **0:40–1:30 — Import and detection.** Sign in as Analyst, open **Import logs**, select the generated JSON, inspect accepted/duplicate/rejected counts, then explicitly confirm. Search the incidents queue for the printed actor label. The six failures trigger `failed-login-burst-v1`; inspect the 20-point Low priority score and “Why this score?” factor breakdown.
3. **1:30–2:15 — Evidence and export.** Open the incident and compare frozen trigger evidence with the separately labeled, live related-event context. Download both PDF and JSON. Confirm “as of” time, rule/configuration version, score factors, provider/receipt data, and the simulated-containment statement. An Analyst export does not include Admin audit metadata.
4. **2:15–3:10 — Collaboration and notifications.** Sign in as Admin and assign the incident or request investigation for the selected Analyst. Return to the Analyst profile and confirm only that account gets the notification. Add an investigation note; verify author and timestamp.
5. **3:10–4:10 — Independent approval.** As Analyst, request simulated containment with a reason. Confirm an active Admin receives the review notice. The requester cannot decide the request. Approve from a different Admin account; the score itself does not authorize this action.
6. **4:10–5:00 — Worker recovery and receipt.** Stop the worker before approval if you want to demonstrate queue recovery. After the independent Admin approval, start the worker again. Confirm job completion, actual provider `LOCAL`, and the simulation receipt in the incident and exported report. No account, network, or device is changed.

For the legacy HTTP simulator instead of importing a file, use `npm.cmd run simulate -- burst day12-simulator-demo`. The script requires a valid local `INGEST_API_KEY` created by `npm.cmd run ingest:setup`.

## Optional Windmill mode

Windmill is opt-in. Set `AUTOMATION_PROVIDER=windmill`, configure `WINDMILL_WEBHOOK_URL` and `WINDMILL_TOKEN` in the server-side `.env`, restart app and worker, then follow DAY6.md. Never put provider secrets in client-visible variables.

## Clean up

The generated input file is in the current user's temporary directory. Incidents/events created by the demo are ordinary local records and can remain for review. Do not reset or delete an existing database to clean up this walkthrough.
