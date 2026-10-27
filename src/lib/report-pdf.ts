import {REPORT_EVIDENCE_LIMIT,type InvestigationReport} from './investigation-report';

const PAGE_W=612,PAGE_H=792,LEFT=48,RIGHT=564,TOP=724,BOTTOM=54,LINE=12;
const printable=(value:unknown)=>String(value??'Unavailable').replace(/[\r\n\t]+/g,' ').replace(/[\u0000-\u001f\u007f-\uffff]/g,'?');
const pdfEscape=(value:string)=>printable(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const approxWidth=(text:string,size:number)=>[...text].reduce((sum,ch)=>sum+(/[il.,'!:;|]/.test(ch)?0.27:/[MW@#%]/.test(ch)?0.82:0.52),0)*size;
function wrap(text:string,size:number,width:number){const words=printable(text).split(/\s+/),lines:string[]=[];let line='';for(const word of words){if(approxWidth(word,size)>width){if(line){lines.push(line);line='';}let fragment='';for(const char of word){if(approxWidth(fragment+char,size)>width&&fragment){lines.push(fragment);fragment='';}fragment+=char;}line=fragment;continue;}const next=line?`${line} ${word}`:word;if(approxWidth(next,size)>width&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines.length?lines:[''];}
class PdfPage{
 ops:string[]=[];y=TOP;constructor(private pageNo:number){}
 text(value:string,x:number,y:number,size=9,font='F1',color='.12 .15 .18'){this.ops.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);}
 line(x1:number,y1:number,x2:number,y2:number,color='.76 .79 .82',width=.6){this.ops.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);}
 rect(x:number,y:number,w:number,h:number,fill='.91 .93 .94'){this.ops.push(`${fill} rg ${x} ${y} ${w} ${h} re f`);}
}
type TableColumn={label:string;width:number};
export function renderInvestigationPdf(report:InvestigationReport):Uint8Array{
 const pages:PdfPage[]=[];let page!:PdfPage;
 const startPage=()=>{page=new PdfPage(pages.length+1);pages.push(page);page.text('SENTINELX  /  SECURITY OPERATIONS',LEFT,PAGE_H-29,8,'F2','.25 .30 .34');page.text('INVESTIGATION REPORT',RIGHT-130,PAGE_H-29,8,'F2','.25 .30 .34');page.line(LEFT,PAGE_H-38,RIGHT,PAGE_H-38);page.y=TOP;};
 startPage();
 const ensure=(height:number)=>{if(page.y-height<BOTTOM){startPage();return true;}return false;};
 const paragraph=(value:unknown,size=9,font='F1',indent=0,color='.12 .15 .18')=>{const lines=wrap(printable(value),size,RIGHT-LEFT-indent);for(const line of lines){ensure(size+3);page.text(line,LEFT+indent,page.y,size,font,color);page.y-=size+3;}page.y-=3;};
 const heading=(value:string)=>{ensure(28);page.y-=2;page.text(value.toUpperCase(),LEFT,page.y,11,'F2','.12 .15 .18');page.y-=8;page.line(LEFT,page.y,RIGHT,page.y);page.y-=14;};
 const table=(columns:TableColumn[],rows:string[][])=>{
  const total=columns.reduce((sum,column)=>sum+column.width,0),drawHeader=()=>{if(page.y-24<BOTTOM)startPage();page.rect(LEFT,page.y-18,RIGHT-LEFT,20);let x=LEFT+6;columns.forEach(column=>{page.text(column.label,x,page.y-12,7.6,'F2','.14 .17 .20');x+=column.width;});page.y-=23;};
  drawHeader();
  for(const row of rows){const lines=row.map((cell,index)=>wrap(cell,7.6,columns[index].width-10)),max=Math.max(1,...lines.map(value=>value.length)),lineHeight=10;let consumed=0;
   while(consumed<max){const available=Math.max(1,Math.floor((page.y-BOTTOM-10)/lineHeight));if(available<=0){startPage();drawHeader();continue;}const take=Math.min(available,max-consumed),height=take*lineHeight+8;let x=LEFT+5;for(let column=0;column<columns.length;column++){for(let index=0;index<take;index++){const text=lines[column][consumed+index];if(text)page.text(text,x,page.y-10-index*lineHeight,7.6,'F1','.15 .18 .21');}x+=columns[column].width;}page.y-=height;page.line(LEFT,page.y,RIGHT,page.y);consumed+=take;if(consumed<max){startPage();drawHeader();}}
   if(page.y<BOTTOM+20){startPage();drawHeader();}
  }
  void total;page.y-=7;
 };
 const jsonBlock=(label:string,value:unknown)=>{heading(label);const lines=JSON.stringify(value,null,2).split('\n');for(const original of lines){for(const line of wrap(original,7.6,RIGHT-LEFT-16)){ensure(12);page.text(line,LEFT+8,page.y,7.6,'F1','.20 .24 .28');page.y-=11;}}page.y-=8;};
 const item=report as unknown as Record<string,any>,incident=item.incident??{};
 page.text('Incident investigation',LEFT,page.y,21,'F2','.08 .10 .12');page.y-=28;
 paragraph(incident.title??'Untitled incident',13,'F2');
 paragraph(`Report as of ${item.asOf??'unavailable'} UTC  |  Incident ${incident.id??'unavailable'}`,8,'F1',0,'.31 .35 .39');
 paragraph(item.simulationNotice,9,'F2');page.y-=6;
 heading('Incident summary');
 table([{label:'Field',width:142},{label:'Value',width:RIGHT-LEFT-142}],[
  ['Rule',incident.rule??'Not recorded'],['Status',incident.status??'Not recorded'],['Severity',incident.severity??'Not recorded'],['Created (UTC)',incident.createdAt??'Not recorded'],['Updated (UTC)',incident.updatedAt??'Not recorded'],['Incident ID',incident.id??'Not recorded'],['Detection configuration version',incident.detectionConfigurationVersion??'Unavailable for this incident'],['Current assignment',item.assignment?.analystName??'Unassigned'],
 ]);
 heading('Incident priority');const priority=incident.priority;
 if(!priority)paragraph('No priority score was recorded for this incident.');else{paragraph(`Incident priority score: ${priority.score} / 100  |  ${priority.band}  |  ${priority.scoringVersion}  |  calculated ${priority.scoredAt??'time unavailable'}`,9,'F2');table([{label:'Contributing factor',width:160},{label:'Points',width:55},{label:'Explanation',width:RIGHT-LEFT-215}],(priority.factors??[]).map((factor:any)=>[factor.label??factor.key,String(factor.points??0),factor.explanation??'No explanation recorded']));}
 jsonBlock('Immutable triggering evidence (stored snapshot)',item.triggeringEvidence??{});
 const eventRows=(item.triggeringEvents?.items??[]).map((event:any)=>[event.occurred_at??'',event.id??'',event.event_type??'',event.actor??'',`${event.source_ip??''} / ${event.source??''}`,JSON.stringify({ingestedAt:event.ingested_at??null,payload:event.payload??{}})]);
 heading('Exact triggering event records');paragraph(`${eventRows.length} available records; limit ${item.triggeringEvents?.limit??REPORT_EVIDENCE_LIMIT}. Missing referenced records: ${item.triggeringEvents?.missingCount??0}. Truncated: ${item.triggeringEvents?.truncated?'Yes':'No'}`,8);
 if(eventRows.length)table([{label:'Event time (UTC)',width:82},{label:'Event ID',width:111},{label:'Type',width:64},{label:'Actor label',width:85},{label:'IP / Source',width:88},{label:'Received time / payload',width:RIGHT-LEFT-430}],eventRows);else paragraph('No linked event rows are available.');
 heading('Related events');paragraph(item.relatedEvents?.reason??'Not included.');
 heading('Current assignment and investigation notes');paragraph(item.assignment?.analystName?`Assigned Analyst: ${item.assignment.analystName} (user ID ${item.assignment.analystId})`:'Currently unassigned');
 const notes=(item.notes?.items??[]) as any[];if(!notes.length)paragraph('No investigation notes are recorded.');for(const note of notes){paragraph(`${note.created_at??''} UTC  |  ${note.author??'Former or unavailable user'}  |  NOTE`,8,'F2');paragraph(note.note??'',9,'F1',12);}
 if(item.notes?.truncated)paragraph('Note/history truncation: older entries are omitted; the most recent 100 are included.',8,'F2');
 heading('Authorized incident history');const histories=(item.history?.items??[]) as any[];if(histories.length)table([{label:'Time (UTC)',width:85},{label:'History ID',width:85},{label:'Action',width:90},{label:'Author',width:90},{label:'Details',width:RIGHT-LEFT-350}],histories.map(h=>[h.created_at??'',h.id??'',h.action??'',h.author??'System / unavailable',JSON.stringify(h.details??{})]));else paragraph('No incident history is recorded.');
 if(item.history?.truncated)paragraph('History is truncated to the most recent 100 entries.');
 heading('Response requests and decisions');const responses=(item.responses?.items??[]) as any[];if(!responses.length)paragraph('No response requests are recorded.');for(const response of responses){paragraph(`Request ${response.id}  |  ${response.status}  |  created ${response.created_at}  |  requested by ${response.requester}`,8,'F2');paragraph(`Target actor: ${response.target_actor??'Unavailable'}  |  Reason: ${response.reason??'Unavailable'}`,9);if(response.approver||response.decided_at)paragraph(`Decision: ${response.status} by ${response.approver??'unavailable'} at ${response.decided_at??'time unavailable'}  |  ${response.decision_note??'No decision note'}`,9);if(response.result)jsonBlock('Stored response receipt',response.result);}
 if(item.responses?.truncated)paragraph('Response request history is truncated to the most recent 50 requests.');
 heading('Automation outcomes and provider');const jobs=(item.automation?.items??[]) as any[];if(!jobs.length)paragraph('No automation job is recorded.');for(const job of jobs){paragraph(`Job ${job.id}  |  ${job.kind}  |  ${job.status}  |  provider ${job.provider??'not yet recorded'}  |  attempts ${job.attempts}  |  queued ${job.createdAt}  |  completed ${job.finishedAt??'not completed'}`,8,'F2');jsonBlock('Recorded automation outcome',job.outcome??{});if(job.error)paragraph(job.error,8,'F1',0,'.32 .20 .18');}
 if(item.automation?.truncated)paragraph('Automation history is truncated to the most recent 50 jobs.');
 const audit=item.restrictedAudit;if(audit?.included){heading('Admin-restricted audit details');const entries=(audit.items??[]) as any[];if(entries.length)table([{label:'Time (UTC)',width:82},{label:'Audit ID',width:80},{label:'Action',width:110},{label:'Admin/system',width:95},{label:'Metadata',width:RIGHT-LEFT-367}],entries.map(a=>[a.created_at??'',a.id??'',a.action??'',a.actor??'System',JSON.stringify(a.metadata??{})]));else paragraph('No incident-specific audit records are recorded.');if(audit.truncated)paragraph('Admin audit history is truncated to the most recent 100 entries.');}else{heading('Restricted audit details');paragraph('Admin permission is required to include audit metadata.');}
 heading('Report limits and interpretation');for(const limitation of item.dataLimitations??[])paragraph(`• ${limitation}`,8);
 for(let i=0;i<pages.length;i++){const p=pages[i];p.line(LEFT,38,RIGHT,38);p.text(`Incident ${incident.id??'unavailable'}  |  Generated ${item.asOf??'unavailable'}`,LEFT,24,7,'F1','.34 .38 .42');p.text(`Page ${i+1} of ${pages.length}`,RIGHT-48,24,7,'F1','.34 .38 .42');}
 return assemble(pages);
}
function assemble(pages:PdfPage[]):Uint8Array{
 const objects:string[]=[];const add=(value:string)=>{objects.push(value);return objects.length;};
 const catalogId=add(''),pagesId=add(''),regularId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),boldId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),pageIds:number[]=[];
 for(const page of pages){const content=page.ops.join('\n'),contentId=add(`<< /Length ${Buffer.byteLength(content,'ascii')} >>\nstream\n${content}\nendstream`);const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`);pageIds.push(pageId);}
 objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
 let output='%PDF-1.4\n%SentinelX report\n';const offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(output,'ascii'));output+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(output,'ascii');output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))output+=`${String(offset).padStart(10,'0')} 00000 n \n`;output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(output,'ascii'));
}
