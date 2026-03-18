-- Migration: Phase 3 & 4 - Planning Calendar and Analytics
-- Created: 2025-11-11
-- Description: Adds calendar events, capacity tracking, and analytics functions

-- ============================================================================
-- PHASE 3: PLANNING CALENDAR
-- ============================================================================

-- Table: calendar_events
-- Purpose: Track pickup/delivery events and vehicle maintenance windows
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('pickup', 'delivery', 'maintenance', 'blocked')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  assigned_vehicle_id UUID REFERENCES wialon_vehicles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: vehicle_capacity_snapshots
-- Purpose: Daily capacity utilization tracking for planning
CREATE TABLE IF NOT EXISTS vehicle_capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  vehicle_id UUID REFERENCES wialon_vehicles(id) ON DELETE CASCADE,
  total_capacity_kg DECIMAL(10,2),
  utilized_capacity_kg DECIMAL(10,2),
  utilization_percentage DECIMAL(5,2),
  assigned_loads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, vehicle_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_vehicle ON calendar_events(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_load ON calendar_events(load_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_date ON vehicle_capacity_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_vehicle ON vehicle_capacity_snapshots(vehicle_id);

-- Create immutable function for date casting
CREATE OR REPLACE FUNCTION immutable_date(timestamptz)
RETURNS date AS $$
  SELECT $1::date;
$$ LANGUAGE SQL IMMUTABLE;

-- Index on pickup date using immutable function
CREATE INDEX IF NOT EXISTS idx_loads_pickup_date ON loads(immutable_date(pickup_datetime)) WHERE status = 'pending';

-- View: load_consolidation_opportunities
-- Purpose: Identify loads that can be combined for efficiency
CREATE OR REPLACE VIEW load_consolidation_opportunities AS
SELECT
  l1.id as load_1_id,
  l2.id as load_2_id,
  l1.destination as common_destination,
  l1.pickup_datetime::date as pickup_date,
  l1.weight_kg + l2.weight_kg as combined_weight,
  l1.origin as origin,
  COUNT(*) OVER (PARTITION BY l1.destination, l1.pickup_datetime::date) as loads_for_route
FROM loads l1
JOIN loads l2 ON
  l1.destination = l2.destination
  AND l1.pickup_datetime::date = l2.pickup_datetime::date
  AND l1.id < l2.id
  AND l1.status = 'pending'
  AND l2.status = 'pending'
WHERE l1.assigned_vehicle_id IS NULL AND l2.assigned_vehicle_id IS NULL;

-- ============================================================================
-- PHASE 4: ANALYTICS & OPTIMIZATION
-- ============================================================================

-- Function: calculate_route_efficiency
-- Purpose: Calculate efficiency metrics for routes over a date range
CREATE OR REPLACE FUNCTION calculate_route_efficiency(
  p_start_date DATE,
  p_end_date DATE,
  p_route_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  route TEXT,
  total_loads INTEGER,
  avg_delivery_time_hours DECIMAL(10,2),
  on_time_percentage DECIMAL(5,2),
  avg_fuel_cost DECIMAL(10,2),
  efficiency_score DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.origin || ' → ' || l.destination as route,
    COUNT(*)::INTEGER as total_loads,
    AVG(EXTRACT(EPOCH FROM (l.actual_delivery_time - l.pickup_datetime))/3600)::DECIMAL(10,2) as avg_delivery_time_hours,
    (COUNT(*) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery_time <= l.delivery_window_end) * 100.0 /
      NULLIF(COUNT(*) FILTER (WHERE l.status = 'delivered'), 0))::DECIMAL(5,2) as on_time_percentage,
    AVG(l.estimated_cost)::DECIMAL(10,2) as avg_fuel_cost,
    -- Efficiency score: (on-time% * 0.6) + ((100-avg_hours)/24 * 0.4)
    (COALESCE(
      (COUNT(*) FILTER (WHERE l.status = 'delivered' AND l.actual_delivery_time <= l.delivery_window_end) * 100.0 /
        NULLIF(COUNT(*) FILTER (WHERE l.status = 'delivered'), 0)) * 0.6, 0) +
      COALESCE(
        ((100 - AVG(EXTRACT(EPOCH FROM (l.actual_delivery_time - l.pickup_datetime))/3600)) / 24 * 100 * 0.4), 0)
    )::DECIMAL(5,2) as efficiency_score
  FROM loads l
  WHERE l.pickup_datetime::date BETWEEN p_start_date AND p_end_date
    AND (p_route_filter IS NULL OR l.destination ILIKE '%' || p_route_filter || '%')
    AND l.status IN ('in_transit', 'delivered')
  GROUP BY l.origin, l.destination
  HAVING COUNT(*) > 0
  ORDER BY efficiency_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function: get_route_frequency_stats
-- Purpose: Analyze frequency and patterns of routes
CREATE OR REPLACE FUNCTION get_route_frequency_stats(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  farm TEXT,
  destination TEXT,
  total_loads INTEGER,
  avg_loads_per_week DECIMAL(10,2),
  peak_day TEXT,
  most_common_packaging TEXT,
  total_weight_kg DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH route_stats AS (
    SELECT
      l.origin as farm,
      l.destination,
      l.id,
      EXTRACT(WEEK FROM l.pickup_datetime) as week_num,
      EXTRACT(DOW FROM l.pickup_datetime) as day_of_week,
      CASE
        WHEN array_length(l.special_requirements, 1) > 0
        THEN l.special_requirements[1]
        ELSE 'Not Specified'
      END as packaging,
      l.weight_kg
    FROM loads l
    WHERE l.pickup_datetime::date BETWEEN p_start_date AND p_end_date
  ),
  aggregated AS (
    SELECT
      rs.farm,
      rs.destination,
      COUNT(DISTINCT rs.id)::INTEGER as total_loads,
      COUNT(DISTINCT rs.week_num)::INTEGER as total_weeks,
      mode() WITHIN GROUP (ORDER BY rs.day_of_week) as peak_day_num,
      mode() WITHIN GROUP (ORDER BY rs.packaging) as most_common_pkg,
      SUM(rs.weight_kg)::DECIMAL(10,2) as total_weight
    FROM route_stats rs
    GROUP BY rs.farm, rs.destination
  )
  SELECT
    a.farm,
    a.destination,
    a.total_loads,
    (a.total_loads::DECIMAL / NULLIF(a.total_weeks, 0))::DECIMAL(10,2) as avg_loads_per_week,
    CASE a.peak_day_num
      WHEN 0 THEN 'Sunday'
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      ELSE 'Unknown'
    END as peak_day,
    a.most_common_pkg as most_common_packaging,
    a.total_weight as total_weight_kg
  FROM aggregated a
  ORDER BY a.total_loads DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: forecast_packaging_requirements
-- Purpose: Predict future packaging needs based on historical trends
CREATE OR REPLACE FUNCTION forecast_packaging_requirements(
  p_forecast_weeks INTEGER DEFAULT 4
)
RETURNS TABLE (
  packaging_type TEXT,
  current_weekly_avg INTEGER,
  forecasted_need INTEGER,
  trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH historical AS (
    SELECT
      CASE
        WHEN array_length(l.special_requirements, 1) > 0
        THEN l.special_requirements[1]
        ELSE 'Not Specified'
      END as pkg_type,
      EXTRACT(WEEK FROM l.pickup_datetime)::INTEGER as week_num,
      COUNT(*)::INTEGER as load_count
    FROM loads l
    WHERE l.pickup_datetime >= CURRENT_DATE - INTERVAL '12 weeks'
      AND l.special_requirements IS NOT NULL
      AND array_length(l.special_requirements, 1) > 0
    GROUP BY pkg_type, week_num
  ),
  averages AS (
    SELECT
      h.pkg_type,
      AVG(h.load_count)::INTEGER as weekly_avg,
      COALESCE(REGR_SLOPE(h.load_count, h.week_num), 0) as trend_slope
    FROM historical h
    GROUP BY h.pkg_type
  )
  SELECT
    a.pkg_type as packaging_type,
    a.weekly_avg as current_weekly_avg,
    GREATEST(0, (a.weekly_avg + (a.trend_slope * p_forecast_weeks)))::INTEGER as forecasted_need,
    CASE
      WHEN a.trend_slope > 1 THEN 'Growing'
      WHEN a.trend_slope < -1 THEN 'Declining'
      ELSE 'Stable'
    END as trend
  FROM averages a
  WHERE a.pkg_type IS NOT NULL AND a.pkg_type != ''
  ORDER BY forecasted_need DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: suggest_load_consolidation
-- Purpose: Identify opportunities to combine loads for efficiency
CREATE OR REPLACE FUNCTION suggest_load_consolidation(
  p_date DATE,
  p_max_combined_weight DECIMAL DEFAULT 25000
)
RETURNS TABLE (
  consolidation_id TEXT,
  load_ids UUID[],
  destination TEXT,
  combined_weight_kg DECIMAL(10,2),
  potential_savings_pct DECIMAL(5,2),
  recommended_vehicle TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH consolidatable_loads AS (
    SELECT
      l.destination,
      l.pickup_datetime::date as pickup_date,
      ARRAY_AGG(l.id) as load_ids,
      SUM(l.weight_kg) as total_weight,
      COUNT(*)::INTEGER as load_count
    FROM loads l
    WHERE l.pickup_datetime::date = p_date
      AND l.status = 'pending'
      AND l.assigned_vehicle_id IS NULL
    GROUP BY l.destination, l.pickup_datetime::date
    HAVING COUNT(*) >= 2 AND SUM(l.weight_kg) <= p_max_combined_weight
  )
  SELECT
    cl.destination || '-' || TO_CHAR(cl.pickup_date, 'YYYYMMDD') as consolidation_id,
    cl.load_ids,
    cl.destination,
    cl.total_weight::DECIMAL(10,2) as combined_weight_kg,
    ((cl.load_count - 1) * 100.0 / cl.load_count)::DECIMAL(5,2) as potential_savings_pct,
    CASE
      WHEN cl.total_weight <= 5000 THEN 'Light Truck'
      WHEN cl.total_weight <= 12000 THEN 'Medium Truck'
      ELSE 'Heavy Truck'
    END as recommended_vehicle
  FROM consolidatable_loads cl
  ORDER BY potential_savings_pct DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for calendar_events
CREATE POLICY "Allow authenticated users to view calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert calendar events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update calendar events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete calendar events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (true);

-- Policies for vehicle_capacity_snapshots
CREATE POLICY "Allow authenticated users to view capacity snapshots"
  ON vehicle_capacity_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert capacity snapshots"
  ON vehicle_capacity_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update capacity snapshots"
  ON vehicle_capacity_snapshots FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update calendar_events.updated_at on modification
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE calendar_events IS 'Stores calendar events for load pickups, deliveries, and vehicle maintenance';
COMMENT ON TABLE vehicle_capacity_snapshots IS 'Daily snapshots of vehicle capacity utilization for planning';
COMMENT ON VIEW load_consolidation_opportunities IS 'Identifies loads that can be consolidated for efficiency';
COMMENT ON FUNCTION calculate_route_efficiency IS 'Calculates efficiency metrics for routes';
COMMENT ON FUNCTION get_route_frequency_stats IS 'Analyzes route frequency patterns and statistics';
COMMENT ON FUNCTION forecast_packaging_requirements IS 'Forecasts future packaging needs based on historical trends';
COMMENT ON FUNCTION suggest_load_consolidation IS 'Suggests load consolidation opportunities for a given date';
