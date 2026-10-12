import { currentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { parseAlertFilters,searchRecord,alertFilterValues,alertSearchSql } from '@/lib/investigation';
export async function GET(request:Request){
 try {
 const user=await currentUser();if(!user)return Response.json({error:'Unauthenticated'},{status:401});
 if(!can(user.role,'alerts:read'))return Response.json({error:'Forbidden'},{status:403});
 const filters=parseAlertFilters(searchRecord(new URL(request.url).searchParams));
 if(!filters.success)return Response.json({error:'Invalid filters'},{status:400});
 const {rows}=await db.query(alertSearchSql,alertFilterValues(filters.data));
 return Response.json({alerts:rows,limit:100,totalMatches:rows[0]?.total_matches??0},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('alerts.read failed',error);return Response.json({error:'Unable to read alerts; check the database and retry'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
