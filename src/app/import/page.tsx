import {requirePermission} from '@/lib/auth';
import {Header} from '@/components/header';
import {LogImporter} from '@/components/log-importer';
export default async function ImportPage(){const user=await requirePermission('events:import');return <><Header user={user}/><div className="app-content"><p className="eyebrow">ANALYST WORKSPACE</p><h1>Import event logs<span className="accent">.</span></h1><p className="page-description">Validate a local CSV or JSON file before confirming ingestion through the normal detection pipeline.</p><LogImporter/></div></>;}
