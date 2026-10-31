import {requirePermission} from '@/lib/auth';
import {db} from '@/lib/db';
import {Header} from '@/components/header';
import {DetectionRuleForm} from '@/components/detection-rule-form';
import {currentDetectionConfig,defaultDetectionRules,ruleDescriptions} from '@/lib/detection-config';
import '@/styles/public.css';
import '@/styles/workspace.css';
export default async function DetectionRulesPage(){
 const user=await requirePermission('rules:manage');
 const config=await currentDetectionConfig(db);
 return <><Header user={user}/><div className="app-content dx-page sx-scope wx-page">
 <header className="wx-head"><div><p className="dx-eyebrow">Admin · Detection policy</p><h1 className="wx-h1">Detection rules</h1><p className="wx-sub">Adjust supported thresholds and event-time windows. Changes are versioned, audited, and apply to new ingested events only.</p></div></header>
 <DetectionRuleForm config={config} descriptions={ruleDescriptions} defaults={defaultDetectionRules as unknown as Record<string,Record<string,number|boolean>>}/>
 </div></>;
}
