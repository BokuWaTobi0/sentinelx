"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { digest, newSession, SESSION_COOKIE } from "@/lib/auth";
// One dummy bcrypt hash prevents skipping costly verification for unknown users.
const dummyHash = hash('dummy-password-never-used',12);
export async function login(form: FormData) {
 const parsed = z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(1).max(72).refine(value => Buffer.byteLength(value) <= 72)}).safeParse(Object.fromEntries(form));
 if (!parsed.success) redirect('/login?error=invalid');
 const {email,password} = parsed.data;
 // Persistent, atomic per-account budget: 10 attempts per 15 minutes.
 let limit,result;
 try {
 limit = await db.query(`INSERT INTO login_limits(key,attempts) VALUES ($1,1)
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END,
 window_start=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END RETURNING attempts`, [digest(email)]);
 result = await db.query('SELECT id,password_hash,disabled FROM users WHERE email=$1', [email]);
 }catch(error){console.error('auth database unavailable',error);redirect('/login?error=unavailable');}
 if (limit.rows[0].attempts > 10) redirect('/login?error=limited');
 const user = result.rows[0];
 const valid = await compare(password, user?.password_hash ?? await dummyHash);
 if (!valid || !user || user.disabled) redirect('/login?error=invalid');
 const session = newSession();
 let client;
 try {
  client = await db.connect();
  await client.query('BEGIN');
  await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [session.tokenHash,user.id,session.expiresAt]);
  await client.query("INSERT INTO audit_logs(user_id,action) VALUES ($1,'auth.login')", [user.id]);
  await client.query('COMMIT');
 } catch(error) { if(client)await client.query('ROLLBACK').catch(()=>{});console.error('auth session storage failed',error);redirect('/login?error=unavailable'); }
 finally { client?.release(); }
 (await cookies()).set(SESSION_COOKIE,session.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',expires:session.expiresAt,maxAge:8*60*60});
 redirect('/dashboard');
}
export async function logout() {
 const jar = await cookies();
 const token = jar.get(SESSION_COOKIE)?.value;
 if(token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
 jar.delete(SESSION_COOKIE);
 redirect('/login');
}
