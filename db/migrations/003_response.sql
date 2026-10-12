CREATE TABLE response_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 incident_id uuid NOT NULL REFERENCES alerts(id),
 requested_by uuid NOT NULL REFERENCES users(id),
 target_actor text NOT NULL CHECK (length(target_actor) BETWEEN 1 AND 500),
 reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 1000),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','REJECTED')),
 decided_by uuid REFERENCES users(id),
 decision_note text,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 CHECK ((status='PENDING' AND decided_by IS NULL AND decided_at IS NULL AND result IS NULL) OR
 (status<>'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decided_by<>requested_by)),
 CHECK (status<>'SUCCEEDED' OR result IS NOT NULL)
);
CREATE UNIQUE INDEX response_one_pending ON response_requests(incident_id) WHERE status='PENDING';
CREATE INDEX response_incident_time ON response_requests(incident_id,created_at DESC);
