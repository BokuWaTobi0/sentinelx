import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationChecks,migrationReady } from '../src/lib/release-readiness';
test('readiness requires every migration and validates prerequisites without exposing credentials',()=>{
 assert.equal(migrationReady(['001_init','002_detection','003_response']),false);
 assert.equal(migrationReady(['001_init','002_detection','003_response','004_automation']),true);
 assert.ok(configurationChecks({}).every(check=>!check.passed));
 const checks=configurationChecks({DATABASE_URL:'postgresql://private-credential',INGEST_API_KEY:'a'.repeat(64),WINDMILL_WEBHOOK_URL:'https://app.windmill.dev/api/w/demo/jobs/run_wait_result/f/u/demo/incident',WINDMILL_TOKEN:'private-token'});
 assert.ok(checks.every(check=>check.passed));
 assert.doesNotMatch(JSON.stringify(checks),/private-credential|private-token/);
});
