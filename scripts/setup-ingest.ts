import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const path='.env';
let contents:string;
try {contents=await readFile(path,'utf8');} catch {throw new Error('Missing .env. Copy .env.example to .env first.');}
const keys=contents.split(/\r?\n/).filter(line=>/^\s*INGEST_API_KEY\s*=/.test(line));
if(keys.length>1) throw new Error('Multiple INGEST_API_KEY entries in .env. Keep exactly one.');
if(keys.length===1 && /^\s*INGEST_API_KEY\s*=\s*[a-f0-9]{64}\s*$/.test(keys[0])) {
 console.log('Existing ingestion key preserved.');
} else if(keys.length===1 && !/^\s*INGEST_API_KEY\s*=\s*$/.test(keys[0])) {
 throw new Error('Existing INGEST_API_KEY is invalid. It must be 64 lowercase hex characters; remove the invalid entry and run setup again.');
} else {
 const entry=`INGEST_API_KEY=${randomBytes(32).toString('hex')}`;
 contents=keys.length===1?contents.replace(/^\s*INGEST_API_KEY\s*=\s*$/m,entry):`${contents.trimEnd()}\n${entry}\n`;
 await writeFile(path,contents,{mode:0o600});
 console.log('Ingestion key saved in .env. Restart the Next.js dev server before simulating.');
}
