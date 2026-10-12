"use server";
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
export async function updateAlert(form:FormData) {
 const user = await requirePermission('alerts:update');
 const {id,status} = z.object({id:z.string().uuid(),status:z.enum(['OPEN','ACKNOWLEDGED','RESOLVED'])}).parse(Object.fromEntries(form));
 const client = await db.connect();
 try {
  await client.query('BEGIN');
  const old = await client.query('SELECT status FROM alerts WHERE id=$1 FOR UPDATE',[id]);
  if(!old.rowCount) throw new Error('Alert not found');
  await client.query('UPDATE alerts SET status=$1,updated_at=now() WHERE id=$2',[status,id]);
  await client.query("INSERT INTO audit_logs(user_id,action,target_id,metadata) VALUES ($1,'alert.status_changed',$2,$3)",[user.id,id,JSON.stringify({from:old.rows[0].status,to:status})]);
  await client.query('COMMIT');
 } catch(error) { await client.query('ROLLBACK'); throw error; }
 finally { client.release(); }
 revalidatePath('/dashboard');
 revalidatePath(`/incidents/${id}`);
 revalidatePath('/admin');
}
