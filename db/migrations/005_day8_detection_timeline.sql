-- Additive Day 8 support for IP-centered detection cooldowns and related-event filtering.
CREATE TABLE detection_cooldowns (
 rule_id text NOT NULL,
 group_key text NOT NULL,
 window_end timestamptz NOT NULL,
 alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
 PRIMARY KEY (rule_id,group_key,window_end)
);

-- Existing actor/type index remains useful for the original rule and event filters.
CREATE INDEX events_actor_time_idx ON events(actor,occurred_at DESC,id DESC);
CREATE INDEX events_source_ip_time_idx ON events(source_ip,occurred_at DESC,id DESC);
CREATE INDEX events_time_order_idx ON events(occurred_at DESC,id DESC);
