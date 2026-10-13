import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationChecks,migrationReady } from '../src/lib/release-readiness';
test('readiness requires every migration and validates prerequisites without exposing credentials',()=>{
 assert.equal(migrationReady(['001_init','002_detection','003_response']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation','005_day8_detection_timeline']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation','005_day8_detection_timeline','006_day9_collaboration']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation','005_day8_detection_timeline','006_day9_collaboration','007_day10_risk_live']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation','005_day8_detection_timeline','006_day9_collaboration','007_day10_risk_live','008_day11_config_import_notifications']),true);
 const empty=configurationChecks({});assert.ok(empty.some(check=>check.name==='Database URL configured'&&!check.passed));assert.ok(empty.some(check=>check.name==='Ingestion key configured'&&!check.passed));assert.ok(empty.some(check=>check.name==='Local automation settings valid'&&check.passed));
 const local=configurationChecks({DATABASE_URL:'postgresql://db',INGEST_API_KEY:'a'.repeat(64)});assert.ok(local.every(check=>check.passed));
 assert.ok(configurationChecks({DATABASE_URL:'postgresql://db',INGEST_API_KEY:'a'.repeat(64),AUTOMATION_PROVIDER:'unsupported'}).some(check=>!check.passed));
 const checks=configurationChecks({DATABASE_URL:'postgresql://private-credential',INGEST_API_KEY:'a'.repeat(64),WINDMILL_WEBHOOK_URL:'https://app.windmill.dev/api/w/demo/jobs/run_wait_result/f/u/demo/incident',WINDMILL_TOKEN:'private-token'});
 assert.ok(checks.every(check=>check.passed));
 assert.doesNotMatch(JSON.stringify(checks),/private-credential|private-token/);
});
