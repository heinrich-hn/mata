-- ============================================================
-- MAT Monitor — Database Migration
-- Adds alert monitoring tables to the shared Supabase backend
-- ============================================================

-- ── 1. alert_configurations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_configurations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  category         TEXT NOT NULL CHECK (category IN (
                     'speed_violation','geofence_breach','fuel_anomaly',
                     'maintenance_due','driver_behavior','vehicle_fault',
                     'trip_delay','load_exception','tyre_pressure','custom'
                   )),
  severity         TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  conditions       JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notify_email     BOOLEAN NOT NULL DEFAULT false,
  notify_push      BOOLEAN NOT NULL DEFAULT true,
  notify_in_app    BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_category ON alert_configurations(category);
CREATE INDEX IF NOT EXISTS idx_alert_configs_active   ON alert_configurations(is_active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alert_configs_updated_at ON alert_configurations;
CREATE TRIGGER trg_alert_configs_updated_at
  BEFORE UPDATE ON alert_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id        UUID REFERENCES alert_configurations(id) ON DELETE SET NULL,
  -- Source
  source_type      TEXT NOT NULL CHECK (source_type IN (
                     'vehicle','driver','trip','load','geofence',
                     'system','maintenance','fuel','tyre','manual'
                   )),
  source_id        UUID,
  source_label     TEXT,
  -- Content
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  category         TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  metadata         JSONB NOT NULL DEFAULT '{}',
  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','acknowledged','resolved','suppressed')),
  acknowledged_by  UUID REFERENCES auth.users(id),
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  -- Timestamps
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity     ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status       ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_source_type  ON alerts(source_type);
CREATE INDEX IF NOT EXISTS idx_alerts_category     ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_live_feed    ON alerts(status, severity, triggered_at DESC);

-- ── 3. alert_comments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  comment    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_comments_alert ON alert_comments(alert_id, created_at);

-- ── 4. alert_subscriptions (Web Push) ────────────────────────
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_subscription JSONB NOT NULL,
  device_label      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  min_severity      TEXT NOT NULL DEFAULT 'medium'
                      CHECK (min_severity IN ('critical','high','medium','low','info')),
  categories        TEXT[],
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_subs_user   ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subs_active ON alert_subscriptions(is_active);

-- ── 5. analytics_events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id   UUID,
  metrics     JSONB NOT NULL DEFAULT '{}',
  dimensions  JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type  ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_occurred_at ON analytics_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_source      ON analytics_events(source_type, source_id);

-- ── 6. dashboard_kpi_snapshots ───────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_kpi_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  period        TEXT NOT NULL CHECK (period IN ('hourly','daily','weekly','monthly')),
  kpi_name      TEXT NOT NULL,
  value         NUMERIC NOT NULL,
  unit          TEXT,
  dimensions    JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, period, kpi_name, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON dashboard_kpi_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_name ON dashboard_kpi_snapshots(kpi_name);

-- ── 7. monitor_audit_log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitor_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,
  resource_id   UUID,
  resource_type TEXT,
  metadata      JSONB DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user   ON monitor_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON monitor_audit_log(action, created_at DESC);

-- ── 8. Row Level Security ─────────────────────────────────────
ALTER TABLE alert_configurations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_audit_log     ENABLE ROW LEVEL SECURITY;

-- alerts: all authenticated users can read; service_role can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Authenticated users can view alerts'
  ) THEN
    CREATE POLICY "Authenticated users can view alerts"
      ON alerts FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Authenticated users can update alert status'
  ) THEN
    CREATE POLICY "Authenticated users can update alert status"
      ON alerts FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='Authenticated users can insert alerts'
  ) THEN
    CREATE POLICY "Authenticated users can insert alerts"
      ON alerts FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- alert_configurations: users manage their own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alert_configurations' AND policyname='Users manage own alert configs'
  ) THEN
    CREATE POLICY "Users manage own alert configs"
      ON alert_configurations FOR ALL TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- alert_comments: all authenticated can read & write own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alert_comments' AND policyname='Users can view all comments'
  ) THEN
    CREATE POLICY "Users can view all comments"
      ON alert_comments FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alert_comments' AND policyname='Users can write own comments'
  ) THEN
    CREATE POLICY "Users can write own comments"
      ON alert_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- alert_subscriptions: users manage own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='alert_subscriptions' AND policyname='Users manage own push subscriptions'
  ) THEN
    CREATE POLICY "Users manage own push subscriptions"
      ON alert_subscriptions FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- analytics_events + kpi_snapshots: read-only for all authenticated
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='analytics_events' AND policyname='Authenticated users can view analytics'
  ) THEN
    CREATE POLICY "Authenticated users can view analytics"
      ON analytics_events FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='analytics_events' AND policyname='Authenticated users can insert analytics'
  ) THEN
    CREATE POLICY "Authenticated users can insert analytics"
      ON analytics_events FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='dashboard_kpi_snapshots' AND policyname='Authenticated users can view KPI snapshots'
  ) THEN
    CREATE POLICY "Authenticated users can view KPI snapshots"
      ON dashboard_kpi_snapshots FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- audit log: users can view own logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='monitor_audit_log' AND policyname='Users can view own audit log'
  ) THEN
    CREATE POLICY "Users can view own audit log"
      ON monitor_audit_log FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ── 9. Enable Realtime on alerts table ───────────────────────
-- Run this in Supabase dashboard if not using CLI:
-- ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE alert_comments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_kpi_snapshots;
