-- Create recurring_schedules table for automated load generation
CREATE TABLE IF NOT EXISTS recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  origin TEXT NOT NULL,
  origin_lat NUMERIC,
  origin_lng NUMERIC,
  destination TEXT NOT NULL,
  destination_lat NUMERIC,
  destination_lng NUMERIC,
  channel TEXT CHECK (channel IN ('retail', 'vendor', 'vansales', 'direct', 'municipal')),
  packaging_type TEXT,
  pallet_count INTEGER DEFAULT 0,
  cargo_type TEXT,
  special_requirements TEXT[],
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  days_of_week INTEGER[] DEFAULT '{}', -- 1=Monday, 7=Sunday
  time_of_day TIME DEFAULT '06:00:00',
  delivery_offset_days INTEGER DEFAULT 1, -- How many days after pickup
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_generated_date DATE,
  total_loads_generated INTEGER DEFAULT 0,
  CONSTRAINT valid_days_of_week CHECK (
    days_of_week <@ ARRAY[1,2,3,4,5,6,7]
  )
);

-- Create index for active schedules
CREATE INDEX idx_recurring_schedules_active ON recurring_schedules(is_active) WHERE is_active = true;

-- Create index for frequency lookups
CREATE INDEX idx_recurring_schedules_frequency ON recurring_schedules(frequency, is_active);

-- Enable RLS
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recurring schedules"
  ON recurring_schedules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create recurring schedules"
  ON recurring_schedules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update recurring schedules"
  ON recurring_schedules FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete recurring schedules"
  ON recurring_schedules FOR DELETE
  USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recurring_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER recurring_schedules_updated_at
  BEFORE UPDATE ON recurring_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_schedules_updated_at();

-- Function to generate loads from recurring schedule
CREATE OR REPLACE FUNCTION generate_loads_from_schedule(
  p_schedule_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '7 days'
)
RETURNS TABLE(generated_count INTEGER, load_ids UUID[]) AS $$
DECLARE
  v_schedule recurring_schedules;
  v_current_date DATE;
  v_load_ids UUID[] := '{}';
  v_count INTEGER := 0;
  v_load_id UUID;
  v_load_number TEXT;
  v_pickup_datetime TIMESTAMPTZ;
  v_delivery_datetime TIMESTAMPTZ;
BEGIN
  -- Get schedule details
  SELECT * INTO v_schedule FROM recurring_schedules WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found or inactive';
  END IF;

  -- Loop through date range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Check if this day matches the schedule
    IF (v_schedule.frequency = 'daily') OR
       (v_schedule.frequency = 'weekly' AND EXTRACT(ISODOW FROM v_current_date)::INTEGER = ANY(v_schedule.days_of_week)) OR
       (v_schedule.frequency = 'monthly' AND EXTRACT(DAY FROM v_current_date) = ANY(v_schedule.days_of_week)) THEN

      -- Generate load number
      v_load_number := 'LD-' || TO_CHAR(v_current_date, 'YYYYMMDD') || '-' ||
                       LPAD((COALESCE(
                         (SELECT MAX(SUBSTRING(load_number FROM '\d{3}$')::INTEGER)
                          FROM loads
                          WHERE load_number LIKE 'LD-' || TO_CHAR(v_current_date, 'YYYYMMDD') || '-%'), 0) + 1)::TEXT, 3, '0');

      -- Calculate datetimes
      v_pickup_datetime := v_current_date + v_schedule.time_of_day;
      v_delivery_datetime := v_current_date + (v_schedule.delivery_offset_days || ' days')::INTERVAL + v_schedule.time_of_day;

      -- Insert load
      INSERT INTO loads (
        load_number,
        customer_name,
        origin,
        origin_lat,
        origin_lng,
        destination,
        destination_address,
        destination_lat,
        destination_lng,
        pickup_datetime,
        pickup_window_start,
        pickup_window_end,
        delivery_datetime,
        delivery_window_start,
        delivery_window_end,
        cargo_type,
        special_requirements,
        weight_kg,
        priority,
        status,
        currency
      ) VALUES (
        v_load_number,
        v_schedule.origin,
        v_schedule.origin,
        v_schedule.origin_lat,
        v_schedule.origin_lng,
        v_schedule.destination,
        v_schedule.destination,
        v_schedule.destination_lat,
        v_schedule.destination_lng,
        v_pickup_datetime,
        v_pickup_datetime,
        v_pickup_datetime + INTERVAL '12 hours',
        v_delivery_datetime,
        v_delivery_datetime,
        v_delivery_datetime + INTERVAL '12 hours',
        COALESCE(v_schedule.cargo_type, v_schedule.channel || ' - ' || v_schedule.packaging_type),
        v_schedule.special_requirements,
        v_schedule.pallet_count * 1200,
        v_schedule.priority,
        'pending',
        v_schedule.currency
      ) RETURNING id INTO v_load_id;

      v_load_ids := array_append(v_load_ids, v_load_id);
      v_count := v_count + 1;
    END IF;

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Update schedule stats
  UPDATE recurring_schedules
  SET
    last_generated_date = p_end_date,
    total_loads_generated = total_loads_generated + v_count
  WHERE id = p_schedule_id;

  RETURN QUERY SELECT v_count, v_load_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON TABLE recurring_schedules IS 'Recurring load schedules for automated load generation (e.g., daily Harare runs, weekly Bulawayo vendor deliveries)';
COMMENT ON FUNCTION generate_loads_from_schedule IS 'Generate loads from a recurring schedule for a date range. Returns count and array of created load IDs.';
