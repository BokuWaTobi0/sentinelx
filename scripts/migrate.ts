import { Pool } from 'pg';
import { applyMigrations } from '../src/lib/migrations';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try {await applyMigrations(client);console.log('Schema ready: 001_init, 002_detection, 003_response, 004_automation');}
finally {client.release();await pool.end();}
