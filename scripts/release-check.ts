import { Pool } from 'pg';
import { configurationChecks,migrationReady } from '../src/lib/release-readiness';
const checks=configurationChecks(process.env);
let pool:Pool|undefined;
try{
 if(process.env.DATABASE_URL){
  pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:10000});
  const {rows}=await pool.query<{version:string}>('SELECT version FROM schema_migrations');
  checks.push({name:'All four migrations applied',passed:migrationReady(rows.map(row=>row.version))});
  const {rows:[roles]}=await pool.query<{roles:string[]}>('SELECT array_agg(DISTINCT role) AS roles FROM users WHERE NOT disabled');
  checks.push({name:'Active Viewer, Analyst and Admin available',passed:['VIEWER','ANALYST','ADMIN'].every(role=>roles?.roles?.includes(role))});
  const {rows:jobs}=await pool.query<{status:string;count:string}>('SELECT status,count(*) FROM automation_jobs GROUP BY status ORDER BY status');
  console.log('Automation queue counts:',JSON.stringify(jobs));
 }
}catch{checks.push({name:'Database reachable and schema readable',passed:false});}
finally{await pool?.end();}
for(const check of checks)console.log(`${check.passed?'PASS':'FAIL'} ${check.name}`);
if(checks.some(check=>!check.passed)){console.log('Fix failed items using DAY7.md before the demo. No records were modified.');process.exitCode=1;}
else console.log('Local prerequisites verified for the selected automation provider. Run automation:check, then the Day 7 browser checklist. No records were modified.');
