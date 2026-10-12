import { Pool } from 'pg';
import { detectLoginBursts,DETECTION_LOCK } from '../src/lib/detector';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock($1)',[DETECTION_LOCK]);
 const {rows}=await client.query<{id:string}>(`SELECT id FROM events WHERE event_type='LOGIN_FAILURE'
  AND occurred_at>=now()-interval '7 days' ORDER BY occurred_at DESC LIMIT 10000`);
 const ids=await detectLoginBursts(client,rows.map(row=>row.id));
 await client.query('COMMIT');
 console.log(`Replay inspected ${rows.length} recent failure events; created ${ids.length} alert(s).`);
 if(rows.length===10000) console.log('Replay is capped at the most recent 10,000 failures for this local MVP.');
} catch(error){await client.query('ROLLBACK');throw error;}
finally {client.release();await pool.end();}
