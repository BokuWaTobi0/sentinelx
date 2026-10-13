import { Pool } from 'pg';
import { applyMigrations } from '../src/lib/migrations';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try {await applyMigrations(client);console.log('Schema ready: 001_init, 002_detection, 003_response, 004_automation, 005_day8_detection_timeline, 006_day9_collaboration');}
finally {client.release();await pool.end();}
