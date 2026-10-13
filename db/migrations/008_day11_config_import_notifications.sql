-- Day 11: versioned prospective detection configuration.
CREATE TABLE detection_config_versions (
 version integer PRIMARY KEY CHECK (version > 0),
 rules jsonb NOT NULL,
 changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO detection_config_versions(version,rules) VALUES (1,'{
 "failed-login-burst-v1":{"enabled":true,"failureThreshold":5,"windowSeconds":60,"cooldownSeconds":60},
 "password-spray-v1":{"enabled":true,"failureThreshold":5,"distinctActorThreshold":5,"windowSeconds":300,"cooldownSeconds":300},
 "ip-failures-across-actors-v1":{"enabled":true,"failureThreshold":10,"distinctActorThreshold":2,"windowSeconds":600,"cooldownSeconds":600},
 "success-after-failure-burst-v1":{"enabled":true,"failureThreshold":5,"failureWindowSeconds":60,"lookbackSeconds":300,"cooldownSeconds":300}
}'::jsonb);
CREATE TABLE detection_config_current (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 version integer NOT NULL REFERENCES detection_config_versions(version)
);
INSERT INTO detection_config_current(singleton,version) VALUES (true,1);
ALTER TABLE alerts ADD COLUMN detection_config_version integer REFERENCES detection_config_versions(version);

-- In-app notifications are private to one active account.
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 incident_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('INCIDENT_NEW','STATUS_CHANGED','ASSIGNED','INVESTIGATION_REQUESTED','RESPONSE_REVIEW_REQUESTED','RESPONSE_DECIDED')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 message text NOT NULL CHECK(length(message) BETWEEN 1 AND 300),
 dedupe_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(recipient_id,dedupe_key)
);
CREATE INDEX notifications_recipient_page_idx ON notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX notifications_recipient_unread_idx ON notifications(recipient_id,created_at DESC) WHERE read_at IS NULL;
ALTER TABLE incident_history DROP CONSTRAINT incident_history_action_check;
ALTER TABLE incident_history ADD CONSTRAINT incident_history_action_check CHECK(action IN ('ASSIGNED','UNASSIGNED','NOTE_ADDED','STATUS_CHANGED','RESPONSE_REQUESTED','RESPONSE_APPROVED','RESPONSE_REJECTED','INVESTIGATION_REQUESTED'));
