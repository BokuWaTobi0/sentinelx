import { readFile } from 'node:fs/promises';
import type { SqlClient } from './sql-client';
export const migrations=['001_init','002_detection','003_response','004_automation','005_day8_detection_timeline','006_day9_collaboration','007_day10_risk_live','008_day11_config_import_notifications','009_day12_automation_provider','010_day13_viewer_escalation'] as const;
export async function applyMigrations(client:SqlClient){
 await client.query('BEGIN');
 try {
  await client.query('SELECT pg_advisory_xact_lock(81421)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for(const version of migrations){
   const applied=await client.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
   if(!applied.rows.length){
    await client.query(await readFile(`db/migrations/${version}.sql`,'utf8'));
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)',[version]);
   }
  }
  await client.query('COMMIT');
 } catch(error){await client.query('ROLLBACK');throw error;}
}
