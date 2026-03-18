-- ============================================================================
-- PHASE 4: DELIVERY ANALYTICS & PERFORMANCE METRICS
-- Comprehensive analytics for delivery performance, driver behavior, costs
-- ============================================================================

-- ============================================================================
-- DELIVERY PERFORMANCE METRICS TABLE
-- Aggregated metrics per delivery
-- ============================================================================
CREATE TABLE public.delivery_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),

  -- Timing metrics
  scheduled_pickup_time TIMESTAMPTZ,
  actual_pickup_time TIMESTAMPTZ,
  scheduled_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,

  -- Duration breakdown (minutes)
  total_duration_minutes INTEGER,
  driving_duration_minutes INTEGER,
  idle_duration_minutes INTEGER,
  rest_stop_duration_minutes INTEGER,
  loading_duration_minutes INTEGER,
  unloading_duration_minutes INTEGER,

  -- Distance metrics
  planned_distance_km NUMERIC(10, 2),
  actual_distance_km NUMERIC(10, 2),
  deviation_distance_km NUMERIC(10, 2), -- How far off route

  -- Speed metrics
  average_speed_kmh NUMERIC(6, 2),
  max_speed_kmh NUMERIC(6, 2),
  time_overspeeding_minutes INTEGER DEFAULT 0,

  -- Performance indicators
  on_time BOOLEAN, -- Arrived within acceptable window
  early_minutes INTEGER,
  late_minutes INTEGER,

  -- Efficiency scores (0-100)
  route_efficiency_score INTEGER, -- How close to optimal route
  time_efficiency_score INTEGER, -- How close to estimated time
  fuel_efficiency_score INTEGER, -- Based on distance vs fuel used
  overall_performance_score INTEGER, -- Weighted average

  -- Incidents
  harsh_braking_count INTEGER DEFAULT 0,
  harsh_acceleration_count INTEGER DEFAULT 0,
  speeding_incidents INTEGER DEFAULT 0,
  unauthorized_stops INTEGER DEFAULT 0,
  geofence_violations INTEGER DEFAULT 0,

  -- Costs (will be calculated)
  fuel_cost NUMERIC(10, 2),
  toll_cost NUMERIC(10, 2),
  driver_cost NUMERIC(10, 2),
  total_delivery_cost NUMERIC(10, 2),
  cost_per_km NUMERIC(10, 2),

  -- Customer satisfaction
  customer_rating INTEGER, -- 1-5 stars
  customer_feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DRIVER BEHAVIOR ANALYTICS TABLE
-- Track driver behavior patterns per trip
-- ============================================================================
CREATE TABLE public.driver_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  driver_name TEXT, -- From loads table

  -- Trip info
  trip_start TIMESTAMPTZ NOT NULL,
  trip_end TIMESTAMPTZ,
  trip_duration_minutes INTEGER,

  -- Driving patterns
  harsh_braking_events INTEGER DEFAULT 0,
  harsh_acceleration_events INTEGER DEFAULT 0,
  harsh_cornering_events INTEGER DEFAULT 0,

  -- Speed behavior
  speeding_duration_minutes INTEGER DEFAULT 0,
  max_speed_recorded NUMERIC(6, 2),
  average_speed NUMERIC(6, 2),
  speed_limit_violations INTEGER DEFAULT 0,

  -- Idling
  total_idle_minutes INTEGER DEFAULT 0,
  excessive_idle_events INTEGER DEFAULT 0, -- More than 10 minutes

  -- Night driving
  night_driving_minutes INTEGER DEFAULT 0, -- 10pm - 5am

  -- Fatigue indicators
  continuous_driving_minutes INTEGER,
  rest_breaks_taken INTEGER DEFAULT 0,
  fatigue_risk_score INTEGER, -- 0-100 (high = risky)

  -- Safety score
  overall_safety_score INTEGER, -- 0-100 (100 = excellent)

  -- Efficiency
  fuel_efficiency_rating TEXT, -- 'excellent', 'good', 'average', 'poor'
  route_adherence_percentage NUMERIC(5, 2), -- How closely followed planned route

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROUTE EFFICIENCY ANALYTICS TABLE
-- Compare planned vs actual routes
-- ============================================================================
CREATE TABLE public.route_efficiency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,

  -- Route comparison
  planned_route_km NUMERIC(10, 2),
  actual_route_km NUMERIC(10, 2),
  deviation_km NUMERIC(10, 2),
  deviation_percentage NUMERIC(5, 2),

  -- Time comparison
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  time_variance_minutes INTEGER, -- Positive = took longer

  -- Traffic and delays
  traffic_delay_minutes INTEGER DEFAULT 0,
  weather_delay_minutes INTEGER DEFAULT 0,
  vehicle_breakdown_minutes INTEGER DEFAULT 0,
  border_crossing_minutes INTEGER DEFAULT 0,
  unauthorized_detour_minutes INTEGER DEFAULT 0,

  -- Waypoint analysis
  planned_waypoints INTEGER,
  actual_waypoints_visited INTEGER,
  missed_waypoints TEXT[], -- Names of missed stops

  -- Efficiency rating
  route_optimization_score INTEGER, -- 0-100
  alternative_routes_available BOOLEAN DEFAULT false,
  estimated_savings_km NUMERIC(10, 2), -- If better route used
  estimated_savings_minutes INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COST TRACKING TABLE
-- Detailed cost breakdown per delivery
-- ============================================================================
CREATE TABLE public.delivery_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  load_id UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),

  -- Fuel costs
  fuel_consumed_liters NUMERIC(8, 2),
  fuel_price_per_liter NUMERIC(6, 2),
  total_fuel_cost NUMERIC(10, 2),
  fuel_cost_per_km NUMERIC(10, 4),

  -- Toll costs
  toll_gates_passed INTEGER DEFAULT 0,
  total_toll_cost NUMERIC(10, 2),
  toll_locations TEXT[], -- Names of toll gates

  -- Labor costs
  driver_hours NUMERIC(6, 2),
  driver_hourly_rate NUMERIC(8, 2),
  driver_overtime_hours NUMERIC(6, 2),
  total_driver_cost NUMERIC(10, 2),

  -- Vehicle costs
  vehicle_depreciation NUMERIC(10, 2),
  maintenance_cost NUMERIC(10, 2),
  tire_wear_cost NUMERIC(10, 2),

  -- Administrative
  insurance_cost NUMERIC(10, 2),
  permit_fees NUMERIC(10, 2),

  -- Revenue
  delivery_revenue NUMERIC(10, 2),

  -- Profitability
  total_cost NUMERIC(10, 2),
  profit_margin NUMERIC(10, 2), -- Revenue - Total Cost
  profit_percentage NUMERIC(5, 2), -- (Profit / Revenue) * 100
  cost_per_km NUMERIC(10, 4),
  cost_per_ton NUMERIC(10, 4), -- If weight tracked

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOMER DELIVERY ANALYTICS TABLE
-- Track delivery performance per customer
-- ============================================================================
CREATE TABLE public.customer_delivery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_name TEXT NOT NULL,

  -- Aggregate metrics
  total_deliveries INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,

  -- Performance percentages
  on_time_percentage NUMERIC(5, 2),

  -- Timing
  average_delivery_time_minutes INTEGER,
  fastest_delivery_minutes INTEGER,
  slowest_delivery_minutes INTEGER,

  -- Distances
  average_distance_km NUMERIC(10, 2),
  total_distance_km NUMERIC(10, 2),

  -- Costs
  average_cost_per_delivery NUMERIC(10, 2),
  total_revenue NUMERIC(12, 2),
  total_cost NUMERIC(12, 2),
  average_profit_margin NUMERIC(10, 2),

  -- Customer satisfaction
  average_rating NUMERIC(3, 2), -- 1.00 to 5.00
  total_ratings INTEGER DEFAULT 0,
  complaints INTEGER DEFAULT 0,

  -- Last delivery
  last_delivery_date TIMESTAMPTZ,
  days_since_last_delivery INTEGER,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_name, period_start, period_end)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Delivery performance
CREATE INDEX idx_delivery_performance_load ON public.delivery_performance(load_id);
CREATE INDEX idx_delivery_performance_vehicle ON public.delivery_performance(vehicle_id);
CREATE INDEX idx_delivery_performance_on_time ON public.delivery_performance(on_time);
CREATE INDEX idx_delivery_performance_score ON public.delivery_performance(overall_performance_score DESC);

-- Driver behavior
CREATE INDEX idx_driver_behavior_load ON public.driver_behavior(load_id);
CREATE INDEX idx_driver_behavior_driver ON public.driver_behavior(driver_name);
CREATE INDEX idx_driver_behavior_safety_score ON public.driver_behavior(overall_safety_score DESC);

-- Route efficiency
CREATE INDEX idx_route_efficiency_load ON public.route_efficiency(load_id);
CREATE INDEX idx_route_efficiency_score ON public.route_efficiency(route_optimization_score DESC);

-- Delivery costs
CREATE INDEX idx_delivery_costs_load ON public.delivery_costs(load_id);
CREATE INDEX idx_delivery_costs_vehicle ON public.delivery_costs(vehicle_id);
CREATE INDEX idx_delivery_costs_profit ON public.delivery_costs(profit_percentage DESC);

-- Customer analytics
CREATE INDEX idx_customer_analytics_name ON public.customer_delivery_analytics(customer_name);
CREATE INDEX idx_customer_analytics_period ON public.customer_delivery_analytics(period_start, period_end);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.delivery_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_efficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_delivery_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage delivery performance"
  ON public.delivery_performance FOR ALL
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage driver behavior"
  ON public.driver_behavior FOR ALL
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage route efficiency"
  ON public.route_efficiency FOR ALL
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage delivery costs"
  ON public.delivery_costs FOR ALL
  TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to view customer analytics"
  ON public.customer_delivery_analytics FOR ALL
  TO authenticated USING (true);

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

-- Calculate overall performance score for a delivery
CREATE OR REPLACE FUNCTION calculate_performance_score(p_load_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_time_score INTEGER;
  v_route_score INTEGER;
  v_safety_score INTEGER;
  v_overall_score INTEGER;
  v_on_time BOOLEAN;
  v_route_deviation NUMERIC;
  v_incidents INTEGER;
BEGIN
  -- Get delivery data
  SELECT
    actual_delivery_time <= scheduled_delivery_time + INTERVAL '30 minutes',
    deviation_distance_km / NULLIF(planned_distance_km, 0),
    harsh_braking_count + harsh_acceleration_count + speeding_incidents
  INTO v_on_time, v_route_deviation, v_incidents
  FROM delivery_performance
  WHERE load_id = p_load_id;

  -- Time score (40% weight)
  v_time_score := CASE
    WHEN v_on_time THEN 100
    ELSE GREATEST(0, 100 - (late_minutes / 10))
  END;

  -- Route score (30% weight)
  v_route_score := GREATEST(0, 100 - (v_route_deviation * 100)::INTEGER);

  -- Safety score (30% weight)
  v_safety_score := GREATEST(0, 100 - (v_incidents * 10));

  -- Weighted average
  v_overall_score := (
    (v_time_score * 0.4) +
    (v_route_score * 0.3) +
    (v_safety_score * 0.3)
  )::INTEGER;

  -- Update the record
  UPDATE delivery_performance
  SET overall_performance_score = v_overall_score
  WHERE load_id = p_load_id;

  RETURN v_overall_score;
END;
$$ LANGUAGE plpgsql;

-- Generate customer analytics for a period
CREATE OR REPLACE FUNCTION generate_customer_analytics(
  p_customer_name TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS VOID AS $$
DECLARE
  v_total INTEGER;
  v_on_time INTEGER;
  v_late INTEGER;
  v_failed INTEGER;
  v_avg_time INTEGER;
  v_avg_distance NUMERIC;
  v_avg_cost NUMERIC;
  v_avg_rating NUMERIC;
BEGIN
  -- Aggregate data
  SELECT
    COUNT(*),
    SUM(CASE WHEN on_time THEN 1 ELSE 0 END),
    SUM(CASE WHEN NOT on_time THEN 1 ELSE 0 END),
    SUM(CASE WHEN loads.status = 'failed_delivery' THEN 1 ELSE 0 END),
    AVG(total_duration_minutes)::INTEGER,
    AVG(actual_distance_km),
    AVG(total_delivery_cost),
    AVG(customer_rating)
  INTO
    v_total, v_on_time, v_late, v_failed,
    v_avg_time, v_avg_distance, v_avg_cost, v_avg_rating
  FROM delivery_performance dp
  JOIN loads ON loads.id = dp.load_id
  WHERE loads.customer_name = p_customer_name
    AND loads.created_at::DATE BETWEEN p_period_start AND p_period_end;

  -- Insert or update analytics
  INSERT INTO customer_delivery_analytics (
    customer_name,
    period_start,
    period_end,
    total_deliveries,
    on_time_deliveries,
    late_deliveries,
    failed_deliveries,
    on_time_percentage,
    average_delivery_time_minutes,
    average_distance_km,
    average_cost_per_delivery,
    average_rating
  ) VALUES (
    p_customer_name,
    p_period_start,
    p_period_end,
    v_total,
    v_on_time,
    v_late,
    v_failed,
    (v_on_time::NUMERIC / NULLIF(v_total, 0) * 100),
    v_avg_time,
    v_avg_distance,
    v_avg_cost,
    v_avg_rating
  )
  ON CONFLICT (customer_name, period_start, period_end)
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    on_time_deliveries = EXCLUDED.on_time_deliveries,
    late_deliveries = EXCLUDED.late_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    on_time_percentage = EXCLUDED.on_time_percentage,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    average_distance_km = EXCLUDED.average_distance_km,
    average_cost_per_delivery = EXCLUDED.average_cost_per_delivery,
    average_rating = EXCLUDED.average_rating,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Calculate cost per kilometer for a delivery
CREATE OR REPLACE FUNCTION calculate_cost_per_km(p_load_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_cost NUMERIC;
  v_distance_km NUMERIC;
  v_cost_per_km NUMERIC;
BEGIN
  SELECT total_cost INTO v_total_cost
  FROM delivery_costs
  WHERE load_id = p_load_id;

  SELECT actual_distance_km INTO v_distance_km
  FROM delivery_performance
  WHERE load_id = p_load_id;

  v_cost_per_km := v_total_cost / NULLIF(v_distance_km, 0);

  UPDATE delivery_costs
  SET cost_per_km = v_cost_per_km
  WHERE load_id = p_load_id;

  RETURN v_cost_per_km;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MATERIALIZED VIEW: DASHBOARD SUMMARY
-- ============================================================================
CREATE MATERIALIZED VIEW public.delivery_dashboard_summary AS
SELECT
  -- Overall metrics
  COUNT(*) AS total_deliveries,
  SUM(CASE WHEN on_time THEN 1 ELSE 0 END) AS on_time_count,
  (SUM(CASE WHEN on_time THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) AS on_time_percentage,

  -- Performance averages
  AVG(overall_performance_score)::INTEGER AS avg_performance_score,
  AVG(route_efficiency_score)::INTEGER AS avg_route_efficiency,
  AVG(time_efficiency_score)::INTEGER AS avg_time_efficiency,

  -- Distance metrics
  SUM(actual_distance_km) AS total_distance_km,
  AVG(actual_distance_km) AS avg_distance_per_delivery,

  -- Cost metrics
  SUM(total_delivery_cost) AS total_costs,
  AVG(total_delivery_cost) AS avg_cost_per_delivery,
  AVG(cost_per_km) AS avg_cost_per_km,

  -- Safety metrics
  SUM(harsh_braking_count) AS total_harsh_braking,
  SUM(speeding_incidents) AS total_speeding_incidents,

  -- Customer satisfaction
  AVG(customer_rating) AS avg_customer_rating
FROM delivery_performance
WHERE created_at >= NOW() - INTERVAL '30 days';

CREATE UNIQUE INDEX ON delivery_dashboard_summary ((1));

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.delivery_performance IS 'Comprehensive performance metrics per delivery';
COMMENT ON TABLE public.driver_behavior IS 'Driver behavior patterns and safety metrics';
COMMENT ON TABLE public.route_efficiency IS 'Route optimization and deviation analysis';
COMMENT ON TABLE public.delivery_costs IS 'Detailed cost breakdown and profitability per delivery';
COMMENT ON TABLE public.customer_delivery_analytics IS 'Aggregated delivery performance per customer';
COMMENT ON MATERIALIZED VIEW public.delivery_dashboard_summary IS 'Pre-calculated dashboard metrics (refresh periodically)';
