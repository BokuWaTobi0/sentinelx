# Day 4 validation
Checked on 2026-10-10.
- TypeScript: passed.
- Automated tests: all 21 passed (six new investigation tests).
- Production Next.js build: passed.
- Browser checks: anonymous dashboard redirect/API 401; server filters; exact eight-event chronological timeline; event detail and exact linked incident; saved status and audit; viewer read-only controls and no audit section; bad UUID 404; invalid filters; event time filtering; mobile layout without horizontal overflow.
- Installer/restore: applied to an isolated Day 3 fixture, backed up files, restored original package.json and removed newly added code. Existing .env stayed byte-for-byte intact.
Browser checks used the real pages, authentication and server actions with an isolated embedded PostgreSQL fixture. This environment does not test your Windows Docker database; follow DAY4.md acceptance checks there.
The ZIP excludes .env, credentials, database files, node_modules and test-database wrappers.
