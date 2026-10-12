import { createHash, timingSafeEqual } from 'node:crypto';
export const MAX_BODY_BYTES=64*1024;
export class BodyTooLarge extends Error {}
export function validIngestToken(header:string|null,configured:string|undefined):boolean {
 // Require a 256-bit key, never a short default/demo password.
 if(!configured || !/^[a-f0-9]{64}$/.test(configured)) return false;
 if(!header || !/^Bearer [a-f0-9]{64}$/.test(header)) return false;
 const hash=(value:string)=>createHash('sha256').update(value).digest();
 return timingSafeEqual(hash(header.slice(7)),hash(configured));
}
export async function readBoundedJson(request:Request):Promise<unknown> {
 const length=request.headers.get('content-length');
 if(length && Number(length)>MAX_BODY_BYTES) throw new BodyTooLarge();
 if(!request.body) throw new SyntaxError('Missing JSON body');
 const reader=request.body.getReader();
 const chunks:Uint8Array[]=[];
 let size=0;
 try {
  while(true) {
   const {done,value}=await reader.read();
   if(done) break;
   size+=value.byteLength;
   if(size>MAX_BODY_BYTES) {await reader.cancel();throw new BodyTooLarge();}
   chunks.push(value);
  }
 } finally {reader.releaseLock();}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
