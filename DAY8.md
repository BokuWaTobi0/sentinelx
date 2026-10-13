# Day 8 — suspicious authentication patterns and investigation timeline

Day 8 adds three deterministic rules alongside the original login-burst detector. Every rule writes a suspicious-pattern incident with its rule ID and immutable event-ID evidence in the same transaction as ingestion. The rules describe patterns in telemetry; they do not confirm an attack. The `actor` field is an unverified producer-supplied label, not an identity assertion.

## Initial rule definitions

| Rule ID | Grouping and threshold | Event-time window and boundary | Cooldown |
| --- | --- | --- | --- |
| `failed-login-burst-v1` (preserved) | One actor label; at least 5 failed logins | Inclusive trailing 60 seconds ending at each failure anchor | Same actor label within ±60 seconds of an existing trigger |
| `password-spray-v1` | One valid source IP; at least 5 failed events and 5 distinct non-null actor labels | Inclusive trailing 5 minutes ending at each failure anchor | Same source IP within ±5 minutes of an existing trigger |
| `ip-failures-across-actors-v1` | One valid source IP; at least 10 failed events and 2 distinct non-null actor labels | Inclusive trailing 10 minutes ending at each failure anchor | Same source IP within ±10 minutes of an existing trigger |
| `success-after-failure-burst-v1` | One actor label; at least 5 failures in an inclusive 60-second window, followed by a successful login | Success must be strictly later than the qualifying failure anchor and no more than 5 minutes after it (the 5-minute limit is inclusive) | Same actor label within ±5 minutes of an existing trigger |

Cooldown comparisons are symmetric around trigger event time so a late-arriving event cannot create a second nearby incident. Rule grouping is independent: an IP can have separate password-spray and repeated-failure findings. A successful login after a burst can also create its own finding. The original actor burst still has its own cooldown and evidence.

Actor grouping uses the exact stored actor string (case-sensitive); it does not normalize aliases or assert that labels name separate verified users. Source IP grouping uses PostgreSQL's parsed `inet` value, so equivalent IPv6 spellings compare as the same address.

All detections use event timestamps, not ingestion time. Candidate anchors include newly inserted events and later existing anchors in the relevant interval; this permits an out-of-order event to complete an earlier window. An ingestion retry with the same event IDs is ignored. The ingestion advisory transaction lock serializes detector work; alert, evidence, cooldown and audit writes commit or roll back together.

The event API currently requires an actor label and a valid IPv4/IPv6 source IP. Malformed or absent IPs are rejected at ingestion. IP rules also skip legacy database events whose IP is null. Null actor values in legacy rows count as attempts but do not contribute to distinct-actor thresholds. IP-centered incidents store `sourceIp` and actor-label lists, but do not set a single `evidence.actor`; the response UI therefore offers no account containment request for these findings. Actor labels are still unverified even on actor-centered incidents, and all response behavior remains simulated.

## Investigation timeline

The upper evidence timeline and detection snapshot are frozen at detection time and contain only the referenced event IDs. The separate **Related event timeline** queries current events later, excludes those immutable evidence IDs, and is explicitly labeled as later context. It supports exact actor label, source IP, and all/24-hour/7-day time filters. Pages contain at most 50 rows, use stable `(occurred_at, id)` keyset ordering, and stop after 10,000 rows per filter set. Only active signed-in users with both incident-read and event-read permissions can use the timeline API; Viewer, Analyst and Admin roles retain their existing read access.

## Local demo and verification

Run from `E:\sentinelx` in PowerShell. These commands apply only pending additive migrations; they do not reset or seed the database. Keep your existing `.env`.

```powershell
$env:AUTOMATION_PROVIDER = 'local'
docker compose up -d --wait
npm.cmd run db:migrate
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run dev
```

In another terminal, start the durable worker:

```powershell
$env:AUTOMATION_PROVIDER = 'local'
npm.cmd run automation:worker
```

From a third terminal, send reproducible event-pattern scenarios. `normal` produces successful everyday sign-ins and remains available as a control case; each attack mode uses fixed event shapes and documented thresholds.

```powershell
npm.cmd run simulate -- normal
npm.cmd run simulate -- burst day8-burst-demo
npm.cmd run simulate -- password-spray
npm.cmd run simulate -- ip-failures
npm.cmd run simulate -- success-after-burst day8-success-demo
```

The simulator creates fresh event IDs for each run; cooldowns intentionally suppress near-duplicate incident patterns. Filter by the scenario's actor or source IP in the event stream, then open the generated incident. Complete checks with:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Local acceptance checklist

1. Run `normal`; confirm no incidents are generated from the few normal failures.
2. Run `burst day8-burst-demo`; open its incident and verify the original rule ID, 5/60-second explanation, frozen event evidence, and LOCAL investigation result.
3. Run `password-spray`; confirm a password-spray incident shows the shared source IP and five actor labels but no account actor or response request form.
4. Run `ip-failures`; confirm a repeated-IP incident shows ten events and two distinct actor labels, with no actor inferred.
5. Run `success-after-burst day8-success-demo`; confirm both the original failure-burst finding and the later-success finding can be reviewed.
6. Use actor, source IP, and time filters on Related event timeline; load another page and confirm snapshot evidence is not duplicated there.
7. Sign in as Viewer, Analyst, and Admin; all can read the timeline while existing mutation permissions remain unchanged.
8. Review immutable evidence separately from later related events and confirm every incident is described as suspicious activity, not a confirmed attack.

## Scope and limitations

Thresholds are intentionally fixed initial values, not user-configurable policy. Actor labels may be aliases, shared values, or attacker-controlled. NAT, proxies, VPNs and shared egress IPs can correlate unrelated users. The detector does not perform geo/IP reputation, risk scoring, account verification, automated blocking, or external threat intelligence. Event-time retention and API validation limit accepted events to the past seven days and at most one minute into the future. Migration `005_day8_detection_timeline` is additive and preserves existing incidents and data.
