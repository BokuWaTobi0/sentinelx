# Delivery validation

- `npm run typecheck`: passed.
- `npm test`: passed the complete role/permission matrix, including unknown-role denial.
- `npm run build`: production compilation and route generation passed with Next.js 16.4.0.
- Executed the SQL migration against embedded PostgreSQL (PGlite) in an isolated temporary check: schema creation, invalid-role rejection, disabled/expired-session query filtering, rollback of alert/audit writes, and the login attempt counter passed.

The embedded SQL check is not a Docker integration or browser test. Docker and a PostgreSQL server are unavailable in the delivery environment. Actual PostgreSQL connectivity, login cookies, sign-out, server-action execution, and browser flows must be checked using the Day 1 acceptance checklist in README.md on your computer.

Dependencies are included in package-lock.json; node_modules and build output are omitted from the ZIP. No credentials for a real system are included. .env.example contains only a localhost demo database/password configuration.
