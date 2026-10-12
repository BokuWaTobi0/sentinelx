# Day 3 verification

Passed:
- TypeScript check, including the updated simulator.
- All 15 automated tests (five existing tests and ten new detector/migration tests).
- Production Next.js build.
- Update installer copied all listed files and preserved .env in a temporary Day 2 project; tested on Linux, with Windows paths to be verified on your machine.
- Simulator custom actor and unchanged UUID/body across a 503 retry, using mocked HTTP.

New PostgreSQL tests cover threshold crossing across requests; successes not counted; eight failures producing one HIGH/OPEN explained alert; repeated-UUID idempotency; exact 60-second inclusion and 60.001-second exclusion; actor separation; slow failures; correlation across IPs/sources; cooldown after resolution; later separate burst; late arrivals; historical replay; audit failure rolling back all writes; lock-before-write ordering; and safe migration of existing users.

Tests execute real SQL using embedded PostgreSQL (PGlite). An adapter uses PGlite.exec for migration files because node-postgres uses the simple query protocol for unparameterized SQL, while PGlite.query prepares statements.

The delivery environment has no Docker/PostgreSQL server. Network/database integration, concurrent requests against PostgreSQL, and browser flows must be checked on your Windows machine using DAY3.md. The locking code and its ordering are tested, but embedded tests do not prove real multi-client contention behavior.
