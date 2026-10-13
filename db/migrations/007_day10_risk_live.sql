-- Day 10: frozen, explainable incident priority scores.
ALTER TABLE alerts ADD COLUMN priority_score integer CHECK (priority_score BETWEEN 0 AND 100);
ALTER TABLE alerts ADD COLUMN priority_band text CHECK (priority_band IN ('LOW','MEDIUM','HIGH','CRITICAL'));
ALTER TABLE alerts ADD COLUMN scoring_version text;
ALTER TABLE alerts ADD COLUMN score_factors jsonb;
ALTER TABLE alerts ADD COLUMN scored_at timestamptz;
CREATE INDEX alerts_priority_page_idx ON alerts(priority_score DESC NULLS LAST, created_at DESC, id DESC);
CREATE INDEX alerts_queue_time_idx ON alerts(created_at DESC, id DESC);
CREATE INDEX automation_jobs_live_idx ON automation_jobs(created_at DESC, id DESC);
CREATE INDEX automation_jobs_incident_live_idx ON automation_jobs(incident_id, created_at DESC, id DESC);
CREATE INDEX events_ingested_at_idx ON events(ingested_at DESC);
