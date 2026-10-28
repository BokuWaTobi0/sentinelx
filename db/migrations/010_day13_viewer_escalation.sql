ALTER TABLE incident_history DROP CONSTRAINT incident_history_action_check;
ALTER TABLE incident_history ADD CONSTRAINT incident_history_action_check CHECK(action IN ('ASSIGNED','UNASSIGNED','NOTE_ADDED','STATUS_CHANGED','RESPONSE_REQUESTED','RESPONSE_APPROVED','RESPONSE_REJECTED','INVESTIGATION_REQUESTED','viewer_escalation.created','viewer_escalation.acknowledged','viewer_escalation.started','viewer_escalation.completed','viewer_escalation.reassigned'));
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK(kind IN ('INCIDENT_NEW','STATUS_CHANGED','ASSIGNED','INVESTIGATION_REQUESTED','RESPONSE_REVIEW_REQUESTED','RESPONSE_DECIDED','ESCALATION_CREATED','ESCALATION_ACKNOWLEDGED','ESCALATION_STARTED','ESCALATION_COMPLETED','ESCALATION_REASSIGNED'));
CREATE TABLE viewer_escalations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
 requester_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, analyst_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 viewer_assessment text CHECK(viewer_assessment IN ('LOW','MEDIUM','HIGH','CRITICAL')), system_score integer CHECK(system_score BETWEEN 0 AND 100), scoring_version text,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 1200), status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACKNOWLEDGED','IN_PROGRESS','COMPLETED')),
 created_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz, started_at timestamptz, completed_at timestamptz,
 conclusion text CHECK(conclusion IS NULL OR length(btrim(conclusion)) BETWEEN 10 AND 2000), version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE UNIQUE INDEX viewer_escalations_one_active_incident_idx ON viewer_escalations(incident_id) WHERE status<>'COMPLETED';
CREATE INDEX viewer_escalations_analyst_status_time_idx ON viewer_escalations(analyst_id,status,created_at DESC);
CREATE INDEX viewer_escalations_requester_time_idx ON viewer_escalations(requester_id,created_at DESC);
