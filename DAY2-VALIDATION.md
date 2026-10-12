# Day 2 validation

Passed:
- TypeScript checking.
- Five automated tests covering role permissions, event validation, timestamp/IP rejection, ingestion credential checks, bounded/malformed request bodies, SQL deduplication and exact parameterized filters, and transactional rollback.
- Production Next.js build with `/events` and `/api/events` routes.
- Update installer copied every manifest file in a temporary project, preserved existing environment settings, and key setup generated one credential and preserved it on rerun. Installer was executed on Linux; Windows-specific paths still require the provided install step on your machine.

The SQL test executes the existing migration and new queries against embedded PostgreSQL (PGlite). It runs without Docker and is included in `npm.cmd test`.

Docker/PostgreSQL network integration and interactive browser flows are not tested in this delivery environment. Complete the acceptance checks in DAY2.md on your running Windows installation. Day 1 login flows remain unchanged.
