ALTER TABLE response_requests DROP CONSTRAINT response_requests_status_check;
ALTER TABLE response_requests ADD CONSTRAINT response_requests_status_check CHECK (status IN ('PENDING','APPROVED','SUCCEEDED','REJECTED'));
CREATE UNIQUE INDEX response_one_active ON response_requests(incident_id) WHERE status IN ('PENDING','APPROVED');
CREATE TABLE automation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 incident_id uuid NOT NULL REFERENCES alerts(id),
 response_id uuid REFERENCES response_requests(id),
 kind text NOT NULL CHECK (kind IN ('INVESTIGATE','CONTAIN_SIMULATED')),
 status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
 payload jsonb NOT NULL,
 result jsonb,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_expires_at timestamptz,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CHECK ((kind='INVESTIGATE' AND response_id IS NULL) OR (kind='CONTAIN_SIMULATED' AND response_id IS NOT NULL)),
 CHECK ((status='RUNNING' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status<>'RUNNING' AND lease_token IS NULL AND lease_expires_at IS NULL))
);
CREATE UNIQUE INDEX automation_investigation_once ON automation_jobs(incident_id) WHERE kind='INVESTIGATE';
CREATE UNIQUE INDEX automation_response_once ON automation_jobs(response_id) WHERE response_id IS NOT NULL;
CREATE INDEX automation_queue ON automation_jobs(status,next_attempt_at);
