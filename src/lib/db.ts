import "server-only";
import { Pool } from "pg";
const globalDb = globalThis as unknown as { sentinelxPool?: Pool };
export const db = globalDb.sentinelxPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
if (process.env.NODE_ENV !== 'production') globalDb.sentinelxPool = db;

if (db.listenerCount('error') === 0) db.on('error', error => console.error('Database idle connection failed', {message:error.message,code:(error as NodeJS.ErrnoException).code}));
