-- Phase 4: GPS Analytics Functions
-- Add database functions to support GPS analytics dashboard

-- Function to get vehicle performance metrics aggregated by vehicle
CREATE OR REPLACE FUNCTION get_vehicle_performance_metrics(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  vehicle_id UUID,
  fleet_number TEXT,
  registration TEXT,
  total_trips BIGINT,
  total_distance_km NUMERIC,
  avg_speed_kmh NUMERIC,
  total_fuel_used_litres NUMERIC,
  fuel_efficiency_l_per_100km NUMERIC,
  harsh_braking_count BIGINT,
  harsh_acceleration_count BIGINT,
  speeding_incidents BIGINT,
  safety_score NUMERIC,
  avg_delivery_time_mins NUMERIC,
  on_time_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id AS vehicle_id,
    v.fleet_number,
    v.registration,
    COUNT(DISTINCT dp.load_id)::BIGINT AS total_trips,
    COALESCE(SUM(dp.actual_distance_km), 0)::NUMERIC AS total_distance_km,
    COALESCE(AVG(db.average_speed_kmh), 0)::NUMERIC AS avg_speed_kmh,
    COALESCE(SUM(dc.total_fuel_litres), 0)::NUMERIC AS total_fuel_used_litres,
    CASE
      WHEN SUM(dp.actual_distance_km) > 0
      THEN (SUM(dc.total_fuel_litres) / SUM(dp.actual_distance_km) * 100)::NUMERIC
      ELSE 0::NUMERIC
    END AS fuel_efficiency_l_per_100km,
    COALESCE(SUM(db.harsh_braking_events), 0)::BIGINT AS harsh_braking_count,
    COALESCE(SUM(db.harsh_acceleration_events), 0)::BIGINT AS harsh_acceleration_count,
    COALESCE(SUM(db.speeding_events), 0)::BIGINT AS speeding_incidents,
    COALESCE(AVG(db.overall_safety_score), 0)::NUMERIC AS safety_score,
    COALESCE(AVG(dp.delivery_time_mins), 0)::NUMERIC AS avg_delivery_time_mins,
    CASE
      WHEN COUNT(dp.load_id) > 0
      THEN (COUNT(CASE WHEN dp.on_time THEN 1 END)::NUMERIC / COUNT(dp.load_id)::NUMERIC * 100)::NUMERIC
      ELSE 0::NUMERIC
    END AS on_time_percentage
  FROM
    public.vehicles v
  LEFT JOIN
    public.delivery_performance dp ON dp.vehicle_id = v.id
    AND dp.created_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN
    public.driver_behavior db ON db.load_id = dp.load_id
  LEFT JOIN
    public.delivery_costs dc ON dc.load_id = dp.load_id
  WHERE
    v.active = true
  GROUP BY
    v.id, v.fleet_number, v.registration
  HAVING
    COUNT(DISTINCT dp.load_id) > 0
  ORDER BY
    total_trips DESC, safety_score DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_vehicle_performance_metrics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Function to get driver performance summary
CREATE OR REPLACE FUNCTION get_driver_performance_summary(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  driver_name TEXT,
  total_trips BIGINT,
  total_distance_km NUMERIC,
  avg_safety_score NUMERIC,
  harsh_braking_total BIGINT,
  harsh_acceleration_total BIGINT,
  speeding_total BIGINT,
  idle_time_total_mins BIGINT,
  on_time_deliveries BIGINT,
  late_deliveries BIGINT,
  on_time_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    db.driver_name,
    COUNT(db.load_id)::BIGINT AS total_trips,
    COALESCE(SUM(db.total_distance_km), 0)::NUMERIC AS total_distance_km,
    COALESCE(AVG(db.overall_safety_score), 0)::NUMERIC AS avg_safety_score,
    COALESCE(SUM(db.harsh_braking_events), 0)::BIGINT AS harsh_braking_total,
    COALESCE(SUM(db.harsh_acceleration_events), 0)::BIGINT AS harsh_acceleration_total,
    COALESCE(SUM(db.speeding_events), 0)::BIGINT AS speeding_total,
    COALESCE(SUM(db.idle_time_mins), 0)::BIGINT AS idle_time_total_mins,
    COUNT(CASE WHEN dp.on_time THEN 1 END)::BIGINT AS on_time_deliveries,
    COUNT(CASE WHEN NOT dp.on_time THEN 1 END)::BIGINT AS late_deliveries,
    CASE
      WHEN COUNT(db.load_id) > 0
      THEN (COUNT(CASE WHEN dp.on_time THEN 1 END)::NUMERIC / COUNT(db.load_id)::NUMERIC * 100)::NUMERIC
      ELSE 0::NUMERIC
    END AS on_time_percentage
  FROM
    public.driver_behavior db
  LEFT JOIN
    public.delivery_performance dp ON dp.load_id = db.load_id
  WHERE
    db.trip_start BETWEEN p_start_date AND p_end_date
    AND db.driver_name IS NOT NULL
  GROUP BY
    db.driver_name
  ORDER BY
    avg_safety_score DESC, total_trips DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_driver_performance_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Function to calculate route efficiency statistics
CREATE OR REPLACE FUNCTION get_route_efficiency_stats(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  avg_efficiency_percentage NUMERIC,
  total_extra_km NUMERIC,
  total_routes BIGINT,
  efficient_routes BIGINT,
  inefficient_routes BIGINT,
  estimated_extra_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(dp.route_efficiency_percentage), 0)::NUMERIC AS avg_efficiency_percentage,
    COALESCE(SUM(GREATEST(dp.actual_distance_km - dp.planned_distance_km, 0)), 0)::NUMERIC AS total_extra_km,
    COUNT(dp.id)::BIGINT AS total_routes,
    COUNT(CASE WHEN dp.route_efficiency_percentage >= 95 THEN 1 END)::BIGINT AS efficient_routes,
    COUNT(CASE WHEN dp.route_efficiency_percentage < 85 THEN 1 END)::BIGINT AS inefficient_routes,
    COALESCE(SUM(GREATEST(dp.actual_distance_km - dp.planned_distance_km, 0) * 3.5), 0)::NUMERIC AS estimated_extra_cost
  FROM
    public.delivery_performance dp
  WHERE
    dp.created_at BETWEEN p_start_date AND p_end_date
    AND dp.planned_distance_km IS NOT NULL
    AND dp.actual_distance_km IS NOT NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_route_efficiency_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Function to get cost per km breakdown
CREATE OR REPLACE FUNCTION get_cost_per_km_breakdown(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_group_by TEXT DEFAULT 'week' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  total_distance_km NUMERIC,
  total_fuel_cost NUMERIC,
  total_driver_cost NUMERIC,
  total_maintenance_cost NUMERIC,
  total_cost NUMERIC,
  cost_per_km NUMERIC,
  total_revenue NUMERIC,
  total_profit NUMERIC,
  profit_margin_percentage NUMERIC,
  number_of_deliveries BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT
      CASE
        WHEN p_group_by = 'day' THEN date_trunc('day', generate_series(p_start_date, p_end_date, '1 day'::interval))
        WHEN p_group_by = 'month' THEN date_trunc('month', generate_series(p_start_date, p_end_date, '1 month'::interval))
        ELSE date_trunc('week', generate_series(p_start_date, p_end_date, '1 week'::interval))
      END AS period_start
  )
  SELECT
    ds.period_start,
    CASE
      WHEN p_group_by = 'day' THEN ds.period_start + INTERVAL '1 day'
      WHEN p_group_by = 'month' THEN ds.period_start + INTERVAL '1 month'
      ELSE ds.period_start + INTERVAL '1 week'
    END AS period_end,
    COALESCE(SUM(dc.distance_km), 0)::NUMERIC AS total_distance_km,
    COALESCE(SUM(dc.total_fuel_cost), 0)::NUMERIC AS total_fuel_cost,
    COALESCE(SUM(dc.total_driver_cost), 0)::NUMERIC AS total_driver_cost,
    COALESCE(SUM(dc.maintenance_cost), 0)::NUMERIC AS total_maintenance_cost,
    COALESCE(SUM(dc.total_cost), 0)::NUMERIC AS total_cost,
    CASE
      WHEN SUM(dc.distance_km) > 0
      THEN (SUM(dc.total_cost) / SUM(dc.distance_km))::NUMERIC
      ELSE 0::NUMERIC
    END AS cost_per_km,
    COALESCE(SUM(dc.revenue), 0)::NUMERIC AS total_revenue,
    COALESCE(SUM(dc.profit_amount), 0)::NUMERIC AS total_profit,
    CASE
      WHEN SUM(dc.revenue) > 0
      THEN (SUM(dc.profit_amount) / SUM(dc.revenue) * 100)::NUMERIC
      ELSE 0::NUMERIC
    END AS profit_margin_percentage,
    COUNT(dc.id)::BIGINT AS number_of_deliveries
  FROM
    date_series ds
  LEFT JOIN
    public.delivery_costs dc ON dc.created_at >= ds.period_start
    AND dc.created_at < (
      CASE
        WHEN p_group_by = 'day' THEN ds.period_start + INTERVAL '1 day'
        WHEN p_group_by = 'month' THEN ds.period_start + INTERVAL '1 month'
        ELSE ds.period_start + INTERVAL '1 week'
      END
    )
  GROUP BY
    ds.period_start
  ORDER BY
    ds.period_start;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_cost_per_km_breakdown(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_vehicle_performance_metrics IS 'Returns aggregated performance metrics for all vehicles within a date range';
COMMENT ON FUNCTION get_driver_performance_summary IS 'Returns aggregated performance metrics for all drivers within a date range';
COMMENT ON FUNCTION get_route_efficiency_stats IS 'Calculates route efficiency statistics including extra km and estimated costs';
COMMENT ON FUNCTION get_cost_per_km_breakdown IS 'Returns cost breakdown grouped by day, week, or month with profit margins';
