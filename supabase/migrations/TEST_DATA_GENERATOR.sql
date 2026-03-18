-- ============================================================================
-- TEST DATA GENERATOR FOR PHASE 2 & 4
-- Use this to populate test data for development and testing
-- ============================================================================

-- WARNING: This script inserts test data. Do NOT run in production!

BEGIN;

-- ============================================================================
-- 1. GET EXISTING IDS FOR TESTING
-- ============================================================================

DO $$
DECLARE
  v_load_id UUID;
  v_vehicle_id UUID;
  v_customer_name TEXT;
BEGIN
  -- Get first available load
  SELECT id, assigned_vehicle_id, customer_name
  INTO v_load_id, v_vehicle_id, v_customer_name
  FROM loads
  WHERE assigned_vehicle_id IS NOT NULL
  LIMIT 1;

  IF v_load_id IS NULL THEN
    RAISE EXCEPTION 'No loads found. Create a load first!';
  END IF;

  RAISE NOTICE '📦 Using Load ID: %', v_load_id;
  RAISE NOTICE '🚛 Using Vehicle ID: %', v_vehicle_id;
  RAISE NOTICE '👤 Customer: %', v_customer_name;

  -- ============================================================================
  -- 2. INSERT TRACKING DATA (GPS BREADCRUMBS)
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '🛰️  Inserting GPS tracking points...';

  -- Simulate a journey from Johannesburg to Harare
  -- Route: JHB (-26.2041, 28.0473) → Harare (-17.8252, 31.0335)

  INSERT INTO delivery_tracking (load_id, vehicle_id, latitude, longitude, speed, heading, is_moving, distance_traveled_km, recorded_at) VALUES
  (v_load_id, v_vehicle_id, -26.2041, 28.0473, 65.0, 0, true, 0.0, NOW() - INTERVAL '6 hours'),
  (v_load_id, v_vehicle_id, -26.1500, 28.1000, 70.5, 15, true, 15.3, NOW() - INTERVAL '5 hours 50 minutes'),
  (v_load_id, v_vehicle_id, -25.8000, 28.3000, 68.2, 20, true, 45.8, NOW() - INTERVAL '5 hours 30 minutes'),
  (v_load_id, v_vehicle_id, -25.5000, 28.6000, 72.1, 25, true, 88.5, NOW() - INTERVAL '5 hours'),
  (v_load_id, v_vehicle_id, -25.0000, 29.0000, 0.0, 30, false, 125.0, NOW() - INTERVAL '4 hours 30 minutes'), -- Rest stop
  (v_load_id, v_vehicle_id, -24.5000, 29.5000, 75.3, 35, true, 175.2, NOW() - INTERVAL '4 hours'),
  (v_load_id, v_vehicle_id, -24.0000, 30.0000, 69.8, 40, true, 225.6, NOW() - INTERVAL '3 hours 30 minutes'),
  (v_load_id, v_vehicle_id, -23.5000, 30.5000, 71.2, 45, true, 280.3, NOW() - INTERVAL '3 hours'),
  (v_load_id, v_vehicle_id, -23.0000, 30.8000, 68.5, 50, true, 330.8, NOW() - INTERVAL '2 hours 30 minutes'),
  (v_load_id, v_vehicle_id, -22.5000, 31.0000, 70.0, 55, true, 385.4, NOW() - INTERVAL '2 hours'),
  (v_load_id, v_vehicle_id, -22.0000, 31.2000, 0.0, 60, false, 435.0, NOW() - INTERVAL '1 hour 30 minutes'), -- Fuel stop
  (v_load_id, v_vehicle_id, -21.5000, 31.3000, 72.8, 65, true, 485.7, NOW() - INTERVAL '1 hour'),
  (v_load_id, v_vehicle_id, -21.0000, 31.4000, 74.1, 70, true, 540.2, NOW() - INTERVAL '30 minutes'),
  (v_load_id, v_vehicle_id, -20.5000, 31.5000, 71.5, 75, true, 590.8, NOW() - INTERVAL '15 minutes'),
  (v_load_id, v_vehicle_id, -20.0000, 31.6000, 69.3, 80, true, 640.5, NOW() - INTERVAL '5 minutes'),
  (v_load_id, v_vehicle_id, -19.5000, 31.7000, 65.7, 85, true, 690.0, NOW());

  RAISE NOTICE '✅ Inserted % tracking points', (SELECT COUNT(*) FROM delivery_tracking WHERE load_id = v_load_id);

  -- ============================================================================
  -- 3. INSERT DELIVERY EVENTS
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '📍 Inserting delivery events...';

  INSERT INTO delivery_events (load_id, vehicle_id, event_type, latitude, longitude, location_name, description, event_timestamp) VALUES
  (v_load_id, v_vehicle_id, 'started', -26.2041, 28.0473, 'Johannesburg Depot', 'Driver departed from depot', NOW() - INTERVAL '6 hours'),
  (v_load_id, v_vehicle_id, 'departed_origin', -26.2041, 28.0473, 'Johannesburg', 'Left pickup location with cargo', NOW() - INTERVAL '5 hours 55 minutes'),
  (v_load_id, v_vehicle_id, 'rest_stop', -25.0000, 29.0000, 'Polokwane Rest Stop', 'Driver 30-minute break', NOW() - INTERVAL '4 hours 30 minutes'),
  (v_load_id, v_vehicle_id, 'fuel_stop', -22.0000, 31.2000, 'Beitbridge Fuel Station', 'Refueling stop', NOW() - INTERVAL '1 hour 30 minutes');

  RAISE NOTICE '✅ Inserted % events', (SELECT COUNT(*) FROM delivery_events WHERE load_id = v_load_id);

  -- ============================================================================
  -- 4. CALCULATE ETA
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '⏱️  Calculating ETA...';

  INSERT INTO delivery_eta (
    load_id,
    estimated_arrival,
    remaining_distance_km,
    average_speed_kmh,
    estimated_duration_minutes,
    confidence_level,
    calculation_method
  ) VALUES (
    v_load_id,
    NOW() + INTERVAL '2 hours',
    120.5,
    70.0,
    120,
    0.85,
    'gps_based'
  );

  RAISE NOTICE '✅ ETA calculated: % minutes', (SELECT estimated_duration_minutes FROM delivery_eta WHERE load_id = v_load_id ORDER BY calculated_at DESC LIMIT 1);

  -- ============================================================================
  -- 5. CREATE GEOFENCE ZONES
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '🛡️  Creating geofence zones...';

  -- Harare destination zone
  INSERT INTO geofence_zones (
    name,
    description,
    zone_type,
    center_lat,
    center_lng,
    radius_meters,
    alert_on_entry,
    alert_on_exit
  ) VALUES (
    'Harare Delivery Zone',
    'Customer delivery location in Harare',
    'customer',
    -17.8252,
    31.0335,
    5000, -- 5km radius
    true,
    false
  );

  -- Beitbridge border zone
  INSERT INTO geofence_zones (
    name,
    description,
    zone_type,
    center_lat,
    center_lng,
    radius_meters,
    alert_on_entry,
    alert_on_exit,
    alert_on_dwell,
    max_dwell_minutes
  ) VALUES (
    'Beitbridge Border Post',
    'South Africa-Zimbabwe border crossing',
    'border',
    -22.3521,
    30.1867,
    2000, -- 2km radius
    true,
    true,
    true,
    60 -- Alert if vehicle stays more than 1 hour
  );

  RAISE NOTICE '✅ Created % geofence zones', (SELECT COUNT(*) FROM geofence_zones);

  -- ============================================================================
  -- 6. INSERT DELIVERY PERFORMANCE DATA
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '📊 Inserting performance data...';

  INSERT INTO delivery_performance (
    load_id,
    vehicle_id,
    scheduled_pickup_time,
    actual_pickup_time,
    scheduled_delivery_time,
    actual_delivery_time,
    total_duration_minutes,
    driving_duration_minutes,
    idle_duration_minutes,
    rest_stop_duration_minutes,
    planned_distance_km,
    actual_distance_km,
    deviation_distance_km,
    average_speed_kmh,
    max_speed_kmh,
    on_time,
    early_minutes,
    route_efficiency_score,
    time_efficiency_score,
    fuel_efficiency_score,
    overall_performance_score,
    harsh_braking_count,
    harsh_acceleration_count,
    speeding_incidents,
    fuel_cost,
    toll_cost,
    driver_cost,
    total_delivery_cost,
    cost_per_km,
    customer_rating,
    customer_feedback
  ) VALUES (
    v_load_id,
    v_vehicle_id,
    NOW() - INTERVAL '7 hours',
    NOW() - INTERVAL '6 hours',
    NOW() + INTERVAL '30 minutes',
    NULL, -- Not yet delivered
    360, -- 6 hours so far
    300,
    30,
    30,
    700.0,
    690.0, -- Slightly under planned
    10.0,
    70.5,
    85.2,
    true,
    0,
    95, -- Excellent route efficiency
    90, -- Good time efficiency
    88, -- Good fuel efficiency
    91, -- Excellent overall
    2,
    1,
    0,
    5500.00, -- Fuel
    850.00, -- Tolls
    2400.00, -- Driver (6 hours @ R400/hour)
    8750.00, -- Total
    12.68, -- Cost per km
    NULL, -- Not yet rated
    NULL
  );

  RAISE NOTICE '✅ Performance data inserted with score: %', (SELECT overall_performance_score FROM delivery_performance WHERE load_id = v_load_id);

  -- ============================================================================
  -- 7. INSERT DRIVER BEHAVIOR DATA
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '👨‍✈️  Inserting driver behavior data...';

  INSERT INTO driver_behavior (
    load_id,
    vehicle_id,
    driver_name,
    trip_start,
    trip_end,
    trip_duration_minutes,
    harsh_braking_events,
    harsh_acceleration_events,
    harsh_cornering_events,
    speeding_duration_minutes,
    max_speed_recorded,
    average_speed,
    total_idle_minutes,
    excessive_idle_events,
    night_driving_minutes,
    continuous_driving_minutes,
    rest_breaks_taken,
    fatigue_risk_score,
    overall_safety_score,
    fuel_efficiency_rating,
    route_adherence_percentage
  ) VALUES (
    v_load_id,
    v_vehicle_id,
    'John Smith',
    NOW() - INTERVAL '6 hours',
    NULL,
    360,
    2,
    1,
    3,
    0, -- No speeding
    85.2,
    70.5,
    30,
    1,
    0, -- No night driving
    180,
    2,
    25, -- Low fatigue risk
    92, -- High safety score
    'excellent',
    98.5
  );

  RAISE NOTICE '✅ Driver behavior inserted with safety score: %', (SELECT overall_safety_score FROM driver_behavior WHERE load_id = v_load_id);

  -- ============================================================================
  -- 8. INSERT DELIVERY COSTS DATA
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '💰 Inserting cost data...';

  INSERT INTO delivery_costs (
    load_id,
    vehicle_id,
    fuel_consumed_liters,
    fuel_price_per_liter,
    total_fuel_cost,
    fuel_cost_per_km,
    toll_gates_passed,
    total_toll_cost,
    toll_locations,
    driver_hours,
    driver_hourly_rate,
    total_driver_cost,
    vehicle_depreciation,
    maintenance_cost,
    total_cost,
    delivery_revenue,
    profit_margin,
    profit_percentage,
    cost_per_km
  ) VALUES (
    v_load_id,
    v_vehicle_id,
    275.0, -- Liters (690km @ 2.5km/L)
    20.00, -- R20 per liter
    5500.00,
    7.97,
    4, -- Toll gates
    850.00,
    ARRAY['Kranskop', 'Modimolle', 'Polokwane', 'Beitbridge'],
    6.0,
    400.00, -- R400 per hour
    2400.00,
    500.00, -- Depreciation
    250.00, -- Maintenance
    9500.00, -- Total cost
    15000.00, -- Revenue
    5500.00, -- Profit
    36.67, -- 36.67% profit margin
    13.77
  );

  RAISE NOTICE '✅ Cost data inserted with profit margin: %', (SELECT profit_percentage FROM delivery_costs WHERE load_id = v_load_id);

  -- ============================================================================
  -- 9. GENERATE CUSTOMER ANALYTICS
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '📈 Generating customer analytics...';

  INSERT INTO customer_delivery_analytics (
    customer_name,
    total_deliveries,
    on_time_deliveries,
    late_deliveries,
    failed_deliveries,
    on_time_percentage,
    average_delivery_time_minutes,
    average_distance_km,
    average_cost_per_delivery,
    total_revenue,
    total_cost,
    average_profit_margin,
    average_rating,
    total_ratings,
    period_start,
    period_end
  ) VALUES (
    v_customer_name,
    5,
    4,
    1,
    0,
    80.0,
    360,
    650.0,
    9000.00,
    75000.00,
    45000.00,
    30000.00,
    4.5,
    5,
    DATE_TRUNC('month', CURRENT_DATE),
    CURRENT_DATE
  );

  RAISE NOTICE '✅ Customer analytics generated for: %', v_customer_name;

  -- ============================================================================
  -- 10. REFRESH DASHBOARD SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '🔄 Refreshing dashboard summary...';

  REFRESH MATERIALIZED VIEW delivery_dashboard_summary;

  RAISE NOTICE '✅ Dashboard summary refreshed';

  -- ============================================================================
  -- 11. SHOW SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ TEST DATA GENERATION COMPLETE!';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  • Tracking points: %', (SELECT COUNT(*) FROM delivery_tracking WHERE load_id = v_load_id);
  RAISE NOTICE '  • Delivery events: %', (SELECT COUNT(*) FROM delivery_events WHERE load_id = v_load_id);
  RAISE NOTICE '  • ETAs calculated: %', (SELECT COUNT(*) FROM delivery_eta WHERE load_id = v_load_id);
  RAISE NOTICE '  • Geofence zones: %', (SELECT COUNT(*) FROM geofence_zones);
  RAISE NOTICE '  • Performance records: %', (SELECT COUNT(*) FROM delivery_performance WHERE load_id = v_load_id);
  RAISE NOTICE '  • Driver behavior records: %', (SELECT COUNT(*) FROM driver_behavior WHERE load_id = v_load_id);
  RAISE NOTICE '  • Cost records: %', (SELECT COUNT(*) FROM delivery_costs WHERE load_id = v_load_id);
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Navigate to Load Management page';
  RAISE NOTICE '  2. Click "Track Live" on the test load';
  RAISE NOTICE '  3. Navigate to /analytics to see dashboard';
  RAISE NOTICE '  4. Verify all data displays correctly';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Load ID for testing: %', v_load_id;
  RAISE NOTICE '';

END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify data was inserted correctly

-- Check tracking data
SELECT
  'Tracking Points' AS table_name,
  COUNT(*) AS record_count,
  MIN(recorded_at) AS earliest,
  MAX(recorded_at) AS latest
FROM delivery_tracking;

-- Check events
SELECT
  'Delivery Events' AS table_name,
  COUNT(*) AS record_count,
  string_agg(DISTINCT event_type, ', ') AS event_types
FROM delivery_events;

-- Check performance
SELECT
  'Performance' AS table_name,
  AVG(overall_performance_score)::INTEGER AS avg_score,
  AVG(on_time::INTEGER * 100)::INTEGER AS on_time_pct
FROM delivery_performance;

-- Check dashboard
SELECT * FROM delivery_dashboard_summary;
