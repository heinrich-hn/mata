-- ============================================================================
-- QUICK APPLY SCRIPT: PHASE 2 & 4
-- Copy and paste this entire script into Supabase SQL Editor
-- ============================================================================

-- This script applies both Phase 2 (Live Tracking) and Phase 4 (Analytics)
-- in the correct order with dependencies resolved.

BEGIN;

-- ============================================================================
-- PHASE 2: LIVE TRACKING TABLES
-- ============================================================================

-- 1. Delivery Tracking Table
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude NUMERIC(8, 2),
  speed NUMERIC(6, 2),
  heading NUMERIC(5, 2),
  accuracy NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distance_from_origin_km NUMERIC(10, 2),
  distance_to_destination_km NUMERIC(10, 2),
  distance_traveled_km NUMERIC(10, 2),
  is_moving BOOLEAN DEFAULT true,
  idle_duration_minutes INTEGER DEFAULT 0,
  battery_level INTEGER,
  signal_strength INTEGER,
  data_source TEXT DEFAULT 'wialon',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_load_id ON public.delivery_tracking(load_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_vehicle_id ON public.delivery_tracking(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_recorded_at ON public.delivery_tracking(recorded_at DESC);

-- 2. Delivery Events Table
CREATE TABLE IF NOT EXISTS public.delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  event_type TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_name TEXT,
  description TEXT,
  notes TEXT,
  photo_url TEXT,
  signature_url TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_load_id ON public.delivery_events(load_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_type ON public.delivery_events(event_type);

-- 3. Delivery ETA Table
CREATE TABLE IF NOT EXISTS public.delivery_eta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  estimated_arrival TIMESTAMPTZ NOT NULL,
  actual_arrival TIMESTAMPTZ,
  calculation_method TEXT DEFAULT 'gps_based',
  remaining_distance_km NUMERIC(10, 2),
  average_speed_kmh NUMERIC(6, 2),
  estimated_duration_minutes INTEGER,
  confidence_level NUMERIC(3, 2),
  traffic_delay_minutes INTEGER DEFAULT 0,
  weather_delay_minutes INTEGER DEFAULT 0,
  rest_stop_minutes INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_delivery_eta_load_id ON public.delivery_eta(load_id);
CREATE INDEX IF NOT EXISTS idx_delivery_eta_current ON public.delivery_eta(is_current) WHERE is_current = true;

-- 4. Geofence Zones Table
CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  zone_type TEXT NOT NULL,
  center_lat NUMERIC(10, 7) NOT NULL,
  center_lng NUMERIC(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL,
  location_id UUID REFERENCES public.predefined_locations(id),
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  alert_on_dwell BOOLEAN DEFAULT false,
  max_dwell_minutes INTEGER DEFAULT 30,
  notify_dispatcher BOOLEAN DEFAULT true,
  notify_customer BOOLEAN DEFAULT false,
  notification_emails TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_zones_active ON public.geofence_zones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_geofence_zones_type ON public.geofence_zones(zone_type);

-- 5. Geofence Events Table
CREATE TABLE IF NOT EXISTS public.geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_zone_id UUID NOT NULL REFERENCES public.geofence_zones(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  load_id UUID REFERENCES public.loads(id),
  event_type TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dwell_duration_minutes INTEGER,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_zone ON public.geofence_events(geofence_zone_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle ON public.geofence_events(vehicle_id);

-- ============================================================================
-- PHASE 4: ANALYTICS TABLES
-- ============================================================================

-- 1. Delivery Performance Table
CREATE TABLE IF NOT EXISTS public.delivery_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  scheduled_pickup_time TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  scheduled_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  total_duration_minutes INTEGER,
  driving_duration_minutes INTEGER,
  idle_duration_minutes INTEGER,
  rest_stop_duration_minutes INTEGER,
  loading_duration_minutes INTEGER,
  unloading_duration_minutes INTEGER,
  planned_distance_km NUMERIC(10, 2),
  actual_distance_km NUMERIC(10, 2),
  deviation_distance_km NUMERIC(10, 2),
  average_speed_kmh NUMERIC(6, 2),
  max_speed_kmh NUMERIC(6, 2),
  time_overspeeding_minutes INTEGER DEFAULT 0,
  on_time BOOLEAN,
  early_minutes INTEGER,
  late_minutes INTEGER,
  route_efficiency_score INTEGER,
  time_efficiency_score INTEGER,
  fuel_efficiency_score INTEGER,
  overall_performance_score INTEGER,
  harsh_braking_count INTEGER DEFAULT 0,
  harsh_acceleration_count INTEGER DEFAULT 0,
  speeding_incidents INTEGER DEFAULT 0,
  unauthorized_stops INTEGER DEFAULT 0,
  geofence_violations INTEGER DEFAULT 0,
  fuel_cost NUMERIC(10, 2),
  toll_cost NUMERIC(10, 2),
  driver_cost NUMERIC(10, 2),
  total_delivery_cost NUMERIC(10, 2),
  cost_per_km NUMERIC(10, 2),
  customer_rating INTEGER,
  customer_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_performance_load ON public.delivery_performance(load_id);
CREATE INDEX IF NOT EXISTS idx_delivery_performance_vehicle ON public.delivery_performance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_delivery_performance_on_time ON public.delivery_performance(on_time);

-- 2. Driver Behavior Table
CREATE TABLE IF NOT EXISTS public.driver_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  driver_name TEXT,
  trip_start TIMESTAMPTZ NOT NULL,
  trip_end TIMESTAMPTZ,
  trip_duration_minutes INTEGER,
  harsh_braking_events INTEGER DEFAULT 0,
  harsh_acceleration_events INTEGER DEFAULT 0,
  harsh_cornering_events INTEGER DEFAULT 0,
  speeding_duration_minutes INTEGER DEFAULT 0,
  max_speed_recorded NUMERIC(6, 2),
  average_speed NUMERIC(6, 2),
  speed_limit_violations INTEGER DEFAULT 0,
  total_idle_minutes INTEGER DEFAULT 0,
  excessive_idle_events INTEGER DEFAULT 0,
  night_driving_minutes INTEGER DEFAULT 0,
  continuous_driving_minutes INTEGER,
  rest_breaks_taken INTEGER DEFAULT 0,
  fatigue_risk_score INTEGER,
  overall_safety_score INTEGER,
  fuel_efficiency_rating TEXT,
  route_adherence_percentage NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_behavior_load ON public.driver_behavior(load_id);
CREATE INDEX IF NOT EXISTS idx_driver_behavior_driver ON public.driver_behavior(driver_name);

-- 3. Route Efficiency Table
CREATE TABLE IF NOT EXISTS public.route_efficiency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  planned_route_km NUMERIC(10, 2),
  actual_route_km NUMERIC(10, 2),
  deviation_km NUMERIC(10, 2),
  deviation_percentage NUMERIC(5, 2),
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  time_variance_minutes INTEGER,
  traffic_delay_minutes INTEGER DEFAULT 0,
  weather_delay_minutes INTEGER DEFAULT 0,
  vehicle_breakdown_minutes INTEGER DEFAULT 0,
  border_crossing_minutes INTEGER DEFAULT 0,
  unauthorized_detour_minutes INTEGER DEFAULT 0,
  planned_waypoints INTEGER,
  actual_waypoints_visited INTEGER,
  missed_waypoints TEXT[],
  route_optimization_score INTEGER,
  alternative_routes_available BOOLEAN DEFAULT false,
  estimated_savings_km NUMERIC(10, 2),
  estimated_savings_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_efficiency_load ON public.route_efficiency(load_id);

-- 4. Delivery Costs Table
CREATE TABLE IF NOT EXISTS public.delivery_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  fuel_consumed_liters NUMERIC(8, 2),
  fuel_price_per_liter NUMERIC(6, 2),
  total_fuel_cost NUMERIC(10, 2),
  fuel_cost_per_km NUMERIC(10, 4),
  toll_gates_passed INTEGER DEFAULT 0,
  total_toll_cost NUMERIC(10, 2),
  toll_locations TEXT[],
  driver_hours NUMERIC(6, 2),
  driver_hourly_rate NUMERIC(8, 2),
  driver_overtime_hours NUMERIC(6, 2),
  total_driver_cost NUMERIC(10, 2),
  vehicle_depreciation NUMERIC(10, 2),
  maintenance_cost NUMERIC(10, 2),
  tire_wear_cost NUMERIC(10, 2),
  insurance_cost NUMERIC(10, 2),
  permit_fees NUMERIC(10, 2),
  delivery_revenue NUMERIC(10, 2),
  total_cost NUMERIC(10, 2),
  profit_margin NUMERIC(10, 2),
  profit_percentage NUMERIC(5, 2),
  cost_per_km NUMERIC(10, 4),
  cost_per_ton NUMERIC(10, 4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_costs_load ON public.delivery_costs(load_id);
CREATE INDEX IF NOT EXISTS idx_delivery_costs_vehicle ON public.delivery_costs(vehicle_id);

-- 5. Customer Delivery Analytics Table
CREATE TABLE IF NOT EXISTS public.customer_delivery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  total_deliveries INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  on_time_percentage NUMERIC(5, 2),
  average_delivery_time_minutes INTEGER,
  fastest_delivery_minutes INTEGER,
  slowest_delivery_minutes INTEGER,
  average_distance_km NUMERIC(10, 2),
  total_distance_km NUMERIC(10, 2),
  average_cost_per_delivery NUMERIC(10, 2),
  total_revenue NUMERIC(12, 2),
  total_cost NUMERIC(12, 2),
  average_profit_margin NUMERIC(10, 2),
  average_rating NUMERIC(3, 2),
  total_ratings INTEGER DEFAULT 0,
  complaints INTEGER DEFAULT 0,
  last_delivery_date TIMESTAMPTZ,
  days_since_last_delivery INTEGER,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_name, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_name ON public.customer_delivery_analytics(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_analytics_period ON public.customer_delivery_analytics(period_start, period_end);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_eta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_efficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_delivery_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for all tables
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'delivery_tracking',
      'delivery_events',
      'delivery_eta',
      'geofence_zones',
      'geofence_events',
      'delivery_performance',
      'driver_behavior',
      'route_efficiency',
      'delivery_costs',
      'customer_delivery_analytics'
    ])
  LOOP
    policy_name := 'Allow authenticated users to manage ' || table_name;

    -- Drop policy if exists
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);

    -- Create policy
    EXECUTE format('
      CREATE POLICY %I
        ON public.%I FOR ALL
        TO authenticated
        USING (true)
    ', policy_name, table_name);
  END LOOP;
END $$;

-- ============================================================================
-- MATERIALIZED VIEW: DASHBOARD SUMMARY
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.delivery_dashboard_summary AS
SELECT
  COUNT(*) AS total_deliveries,
  SUM(CASE WHEN on_time THEN 1 ELSE 0 END) AS on_time_count,
  (SUM(CASE WHEN on_time THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100) AS on_time_percentage,
  AVG(overall_performance_score)::INTEGER AS avg_performance_score,
  AVG(route_efficiency_score)::INTEGER AS avg_route_efficiency,
  AVG(time_efficiency_score)::INTEGER AS avg_time_efficiency,
  SUM(actual_distance_km) AS total_distance_km,
  AVG(actual_distance_km) AS avg_distance_per_delivery,
  SUM(total_delivery_cost) AS total_costs,
  AVG(total_delivery_cost) AS avg_cost_per_delivery,
  AVG(cost_per_km) AS avg_cost_per_km,
  SUM(harsh_braking_count) AS total_harsh_braking,
  SUM(speeding_incidents) AS total_speeding_incidents,
  AVG(customer_rating) AS avg_customer_rating
FROM delivery_performance
WHERE created_at >= NOW() - INTERVAL '30 days';

CREATE UNIQUE INDEX IF NOT EXISTS delivery_dashboard_summary_idx ON delivery_dashboard_summary ((1));

-- ============================================================================
-- ENABLE REALTIME FOR TRACKING TABLES
-- ============================================================================

-- Add tables to realtime publication only if not already added
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'delivery_tracking',
      'delivery_events',
      'delivery_eta',
      'geofence_events'
    ])
  LOOP
    -- Check if table is already in publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      RAISE NOTICE 'Added % to supabase_realtime publication', table_name;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime publication', table_name;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 2 & 4 migrations applied successfully!';
  RAISE NOTICE '📊 Created 10 new tables for tracking and analytics';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
  RAISE NOTICE '📡 Realtime enabled for tracking tables';
  RAISE NOTICE '📈 Dashboard summary materialized view created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Regenerate TypeScript types: npx supabase gen types typescript';
  RAISE NOTICE '2. Test tracking: INSERT test data into delivery_tracking';
  RAISE NOTICE '3. Navigate to /analytics in your app';
END $$;
