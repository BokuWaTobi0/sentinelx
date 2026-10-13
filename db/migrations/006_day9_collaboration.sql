-- Day 9: collaboration state is isolated from restricted audit metadata.
ALTER TABLE alerts ADD COLUMN assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX alerts_assigned_status_time_idx ON alerts(assigned_to,status,created_at DESC,id DESC);

CREATE TABLE incident_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 incident_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL CHECK (action IN ('ASSIGNED','UNASSIGNED','NOTE_ADDED','STATUS_CHANGED','RESPONSE_REQUESTED','RESPONSE_APPROVED','RESPONSE_REJECTED')),
 note text,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((action='NOTE_ADDED' AND note IS NOT NULL AND length(btrim(note)) BETWEEN 1 AND 2000) OR (action<>'NOTE_ADDED' AND note IS NULL))
);
CREATE INDEX incident_history_page_idx ON incident_history(incident_id,created_at DESC,id DESC);
