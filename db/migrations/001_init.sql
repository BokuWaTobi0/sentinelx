CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE CHECK (email = lower(email)),
 name text NOT NULL,
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('VIEWER','ANALYST','ADMIN')),
 disabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE login_limits (
 key text PRIMARY KEY,
 attempts integer NOT NULL,
 window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL,
 event_type text NOT NULL,
 actor text,
 source_ip inet,
 payload jsonb NOT NULL DEFAULT '{}',
 ingested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_time_idx ON events(occurred_at DESC);
CREATE INDEX events_actor_type_idx ON events(actor, event_type, occurred_at DESC);
CREATE TABLE alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid REFERENCES events(id),
 title text NOT NULL,
 rule_id text NOT NULL,
 severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
 evidence jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_status_time_idx ON alerts(status, created_at DESC);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL,
 target_id text,
 metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_time_idx ON audit_logs(created_at DESC);
