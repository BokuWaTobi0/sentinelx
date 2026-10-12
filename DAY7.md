# Day 7 — Release acceptance

## Apply the update
Stop app and worker. Use apply-day7.mjs from the extracted update folder. No database migration or new dependency is introduced. Your .env, queue and stored records remain intact.

## Commands
From E:\sentinelx, with Docker Desktop running:
```powershell
docker compose up -d --wait
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run release:check
npm.cmd run automation:check
npm.cmd run start
```
Keep npm.cmd run automation:worker running in a separate terminal. Stop the dev server before start. If any check fails, stop and correct it before continuing. release:check writes no data. automation:check executes a sample investigation in Windmill.

## Final production-mode walkthrough
Use a new actor each time, for example:
```powershell
npm.cmd run simulate -- burst day7-final-demo
```
1. Without login, dashboard requests sign-in and /api/alerts returns 401.
2. Analyst: filter Exact actor day7-final-demo, open incident, confirm eight linked events and open an event back to the same incident.
3. Worker: investigation reaches SUCCEEDED and provides a summary/recommendation.
4. Analyst: request containment. Admin: approve with a reason. With worker stopped, it must remain APPROVED / AWAITING WINDMILL; restart worker and confirm the receipt and audit entries.
5. Submit a second request as Analyst; reject as Admin. No containment job is created for the rejection.
6. Viewer: no status/request/approval/retry forms; /admin denies access; full incident audit history is absent.
7. Admin request: the same Admin cannot decide it. Normal demo requests should come from Analyst.
8. Repeat the same decision: no duplicate receipt/action. Replaying exact event IDs produces duplicates, not another alert. Running simulate twice generates new IDs and is not an identical replay.
9. Sign out: dashboard requests login again.
10. Inspect desktop and 375px mobile view: navigation, evidence, forms, receipts and long actor/job IDs stay readable.

## Failure checks
Carry forward the Day 6 Windmill outage/retry checks you already completed. Verify the new database-recovery behaviour on your local demo only: stop PostgreSQL, attempt a fresh sign-in, and expect the explicit temporarily-unavailable message. An authenticated page may show the recovery screen; alerts API returns 503. Restart PostgreSQL and retry. Do not reset/delete database data.

## Completion
Day 7 is complete for your installation when the commands pass and the production-mode walkthrough works. The attached validation report distinguishes local automated/browser tests from your real Docker/Windmill environment. Record a short demo using DEMO.md and explain the tradeoffs using ARCHITECTURE.md.
