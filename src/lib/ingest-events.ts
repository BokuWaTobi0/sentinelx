import type { SqlClient } from './sql-client';
import type { SecurityEvent } from './event-schema';
import { eventRecords,insertEventsSql } from './event-sql';
import { detectSecurityPatterns,DETECTION_LOCK } from './detector';
import { currentDetectionConfig } from './detection-config';
export async function ingestEvents(client:SqlClient,events:SecurityEvent[]) {
 await client.query('BEGIN');
 try {
  // Serializes local MVP ingestion/replay before inserting or reading any events.
  // Under PostgreSQL's default READ COMMITTED, the next query sees the prior commit.
  await client.query('SELECT pg_advisory_xact_lock($1)',[DETECTION_LOCK]);
  const inserted=await client.query<{id:string}>(insertEventsSql,[eventRecords(events)]);
  const accepted=inserted.rows.length;
  if(accepted>0) await client.query(`INSERT INTO audit_logs(action,metadata) VALUES ('events.ingested',$1)`,[JSON.stringify({accepted,received:events.length,sources:[...new Set(events.map(event=>event.source))]})]);
  const config=accepted?await currentDetectionConfig(client):undefined;
  const alertIds=await detectSecurityPatterns(client,inserted.rows.map(row=>row.id),config);
  await client.query('COMMIT');
  return {accepted,duplicates:events.length-accepted,alertsCreated:alertIds.length,alertIds};
 } catch(error){await client.query('ROLLBACK');throw error;}
}
