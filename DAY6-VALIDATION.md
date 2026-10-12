# Day 6 validation

Baseline: working Day 5 package composed with Days 1-4 and the UI update.

- TypeScript checks passed.
- Final full suite: all 26 tests passed, with no skips in this environment.
- Production build passed.
- Installer applied all 25 manifest files to a Day 5 fixture, created the backup journal, and preserved .env.
- Actual localhost HTTP integration exercised Authorization headers and payload/result contracts, HTTP 401, oversized JSON, execution errors returned as JSON, mismatched identifiers, and network failure classification.
- Embedded PostgreSQL exercised queue/detection atomicity, duplicate ingestion, active claims, expired-lease recovery, stale-worker suppression, retry scheduling, terminal failure, permission-gated manual retry, final lease exhaustion and injected-audit rollback.
- Updated response tests verify APPROVED is separate from SUCCEEDED and receipt completion is atomic with audit writes.
- Both Python steps executed locally for investigation and containment; self-approval and missing approval were rejected. Embedded flow scripts match the source .py files.

Limits: no live Windmill workspace was connected or deployed from this session. automation:check is provided for that verification. Database tests use PGlite; real multi-connection PostgreSQL load testing and interactive browser QA are not included. On Windows without Python, the optional local Python-flow test is skipped; Windmill supplies its own Python runtime. Real external containment is not implemented.
