import {Pool} from 'pg';
import {scoreIncident} from '../src/lib/risk-score';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();let updated=0,unscored=0;
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(81422)');
 const {rows}=await client.query<{id:string;evidence:Record<string,unknown>}>(`SELECT id,evidence FROM alerts WHERE priority_score IS NULL ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 100000`);
 for(const row of rows){const score=scoreIncident(row.evidence);if(!score){unscored++;continue;}
  const result=await client.query(`UPDATE alerts SET priority_score=$1,priority_band=$2,scoring_version=$3,score_factors=$4,scored_at=now() WHERE id=$5 AND priority_score IS NULL`,[score.score,score.band,score.version,JSON.stringify(score.factors),row.id]);updated+=result.rowCount??0;
 }
 await client.query('COMMIT');console.log(`Backfill examined ${rows.length}; scored ${updated}; insufficient evidence left unscored ${unscored}.`);
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
