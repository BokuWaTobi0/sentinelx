import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { can, type Permission, type Role } from "@/lib/rbac";
export const SESSION_COOKIE = 'sentinelx_session';
export const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export type User = { id: string; email: string; name: string; role: Role };
export async function currentUser(): Promise<User | null> {
 const token = (await cookies()).get(SESSION_COOKIE)?.value;
 if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const result = await db.query<User>(`SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.disabled`, [digest(token)]);
 return result.rows[0] ?? null;
}
export async function requireUser() {
 const user = await currentUser();
 if (!user) redirect('/login');
 return user;
}
export async function requirePermission(permission: Permission) {
 const user = await requireUser();
 if (!can(user.role, permission)) redirect('/forbidden');
 return user;
}
export function newSession() {
 const token = randomBytes(32).toString('hex');
 return { token, tokenHash: digest(token), expiresAt: new Date(Date.now()+8*60*60*1000) };
}
