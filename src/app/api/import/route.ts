import {currentUser} from '@/lib/auth';
import {can} from '@/lib/rbac';
import {db} from '@/lib/db';
import {IMPORT_MAX_BYTES,parseImportBytes,previewImport,confirmImport,type ImportPreview} from '@/lib/log-import';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function prepare(request:Request):Promise<{preview:ImportPreview;userId:string}|Response>{
 const user=await currentUser();if(!user)return json({error:'Session expired. Sign in again.'},401);if(!can(user.role,'events:import'))return json({error:'Forbidden'},403);
 const length=Number(request.headers.get('content-length')??0);if(length>IMPORT_MAX_BYTES+65536)return json({error:'Upload request exceeds the file size limit.'},413);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data'))return json({error:'Upload a CSV or JSON file.'},415);
 const form=await request.formData(),candidate=form.get('file');if(!(candidate instanceof File))return json({error:'Choose a file.'},400);if(candidate.size>IMPORT_MAX_BYTES)return json({error:'File exceeds the 1 MiB limit.'},413);
 try{return {preview:parseImportBytes(new Uint8Array(await candidate.arrayBuffer()),candidate.name),userId:user.id};}catch(error){return json({error:error instanceof Error?error.message:'Could not parse this file.'},400);}
}
export async function POST(request:Request){try{const prepared=await prepare(request);if(prepared instanceof Response)return prepared;return json(await previewImport(db,prepared.preview));}catch(error){console.error('log import preview failed',error);return json({error:'Unable to validate this file.'},503);}}
export async function PUT(request:Request){try{const prepared=await prepare(request);if(prepared instanceof Response)return prepared;const client=await db.connect();try{return json(await confirmImport(client,prepared.userId,prepared.preview));}finally{client.release();}}catch(error){console.error('log import confirm failed',error);return json({error:'Import stopped before completion. Retry the exact same file; supplied IDs and deterministic missing IDs make retries safe.'},503);}}
