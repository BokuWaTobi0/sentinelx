export function IncidentReportActions({incidentId}:{incidentId:string}){
 return <div className="incident-report-actions" aria-label="Download investigation report">
  <a className="button secondary small-button" href={`/api/incidents/${incidentId}/report?format=pdf`} aria-label="Export readable PDF investigation report">Export PDF</a>
  <a className="button secondary small-button" href={`/api/incidents/${incidentId}/report?format=json`} aria-label="Export structured JSON investigation report">Export JSON</a>
 </div>;
}
