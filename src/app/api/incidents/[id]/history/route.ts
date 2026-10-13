import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { incidentHistory } from '@/lib/collaboration';
import { uuidSchema } from '@/lib/investigation';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in to view this incident.'},{status:401});if(!can(user.role,'alerts:read'))return NextResponse.json({error:'You do not have access to this incident.'},{status:403});try{const {id}=await params;if(!uuidSchema.safeParse(id).success)return NextResponse.json({error:'Invalid incident id.'},{status:400});const url=new URL(request.url);const createdAt=url.searchParams.get('createdAt');const cursorId=url.searchParams.get('cursorId');if(Boolean(createdAt)!==Boolean(cursorId)||createdAt&&(!Number.isFinite(Date.parse(createdAt))||!uuidSchema.safeParse(cursorId).success))return NextResponse.json({error:'Invalid history cursor.'},{status:400});const page=await incidentHistory(db,id,createdAt&&cursorId?{createdAt,id:cursorId}:undefined);return NextResponse.json(page,{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Unable to load incident history.'},{status:500});}}
