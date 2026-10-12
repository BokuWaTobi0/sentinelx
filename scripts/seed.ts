import { Pool } from "pg";
import { hash } from "bcryptjs";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Set DEMO_PASSWORD to 12+ characters, at most 72 bytes');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
 await client.query('BEGIN');
 for (const role of ['ADMIN','ANALYST','VIEWER']) {
  await client.query(`INSERT INTO users(email,name,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`,
   [`${role.toLowerCase()}@sentinelx.local`, `${role} Demo`, await hash(password,12), role]);
 }
 await client.query(`INSERT INTO alerts(id,title,rule_id,severity,evidence) VALUES ('00000000-0000-4000-8000-000000000001','Demo: repeated login failures','login-burst-v1','HIGH',$1) ON CONFLICT(id) DO NOTHING`, [JSON.stringify({demo:true,actor:'test-user',failureCount:8,windowSeconds:60})]);
 await client.query('COMMIT');
 console.log('Demo users and alert ready. Existing passwords were preserved.');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
