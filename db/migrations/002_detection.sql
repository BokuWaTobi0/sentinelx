CREATE TABLE detection_windows (
 rule_id text NOT NULL,
 actor text NOT NULL,
 window_end timestamptz NOT NULL,
 alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
 PRIMARY KEY (rule_id,actor,window_end)
);
CREATE INDEX detection_windows_actor_time_idx ON detection_windows(rule_id,actor,window_end);
