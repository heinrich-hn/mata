-- Create enums for maintenance scheduling (with unique names to avoid conflicts)
CREATE TYPE maintenance_schedule_type AS ENUM ('one_time', 'recurring');
CREATE TYPE maintenance_frequency AS ENUM ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom');
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE maintenance_category AS ENUM ('inspection', 'service', 'repair', 'replacement', 'calibration');
CREATE TYPE maintenance_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue', 'skipped');
CREATE TYPE maintenance_alert_type AS ENUM ('upcoming', 'overdue', 'completed', 'cancelled');
CREATE TYPE maintenance_notification_method AS ENUM ('email', 'sms', 'in_app', 'all');
CREATE TYPE maintenance_delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'acknowledged');

-- Main maintenance schedules table
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  schedule_type maintenance_schedule_type NOT NULL DEFAULT 'one_time',
  frequency maintenance_frequency,
  frequency_value INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  next_due_date DATE,
  last_completed_date DATE,
  estimated_duration_hours NUMERIC(10,2),
  priority maintenance_priority NOT NULL DEFAULT 'medium',
  assigned_to TEXT,
  assigned_team TEXT,
  category maintenance_category NOT NULL,
  maintenance_type TEXT NOT NULL,
  alert_before_hours INTEGER[] DEFAULT ARRAY[48, 24, 1],
  notification_channels JSONB DEFAULT '{"email": true, "sms": false, "in_app": true}'::jsonb,
  notification_recipients JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  auto_create_job_card BOOLEAN DEFAULT false,
  related_template_id UUID REFERENCES public.job_card_templates(id) ON DELETE SET NULL,
  odometer_based BOOLEAN DEFAULT false,
  odometer_interval_km INTEGER,
  last_odometer_reading INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by TEXT NOT NULL
);

-- Maintenance history table
CREATE TABLE public.maintenance_schedule_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES public.vehicle_inspections(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  completed_date TIMESTAMP WITH TIME ZONE,
  status maintenance_status NOT NULL DEFAULT 'scheduled',
  completed_by TEXT,
  duration_hours NUMERIC(10,2),
  odometer_reading INTEGER,
  parts_used JSONB DEFAULT '[]'::jsonb,
  labor_hours NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  notes TEXT,
  linked_faults JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Maintenance alerts table
CREATE TABLE public.maintenance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  alert_type maintenance_alert_type NOT NULL,
  alert_time TIMESTAMP WITH TIME ZONE NOT NULL,
  due_date DATE NOT NULL,
  hours_until_due NUMERIC(10,2),
  sent_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by TEXT,
  notification_method maintenance_notification_method NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  delivery_status maintenance_delivery_status DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recurring exceptions table
CREATE TABLE public.maintenance_recurring_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  reason TEXT NOT NULL,
  rescheduled_to DATE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_maintenance_schedules_vehicle ON public.maintenance_schedules(vehicle_id);
CREATE INDEX idx_maintenance_schedules_next_due ON public.maintenance_schedules(next_due_date) WHERE is_active = true;
CREATE INDEX idx_maintenance_schedules_active ON public.maintenance_schedules(is_active);
CREATE INDEX idx_maintenance_history_schedule ON public.maintenance_schedule_history(schedule_id);
CREATE INDEX idx_maintenance_history_job_card ON public.maintenance_schedule_history(job_card_id);
CREATE INDEX idx_maintenance_history_status ON public.maintenance_schedule_history(status);
CREATE INDEX idx_maintenance_alerts_schedule ON public.maintenance_alerts(schedule_id);
CREATE INDEX idx_maintenance_alerts_delivery ON public.maintenance_alerts(delivery_status) WHERE delivery_status = 'pending';

-- Function to calculate next due date
CREATE OR REPLACE FUNCTION public.calculate_next_due_date(
  p_schedule_id UUID,
  p_completed_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_next_date DATE;
  v_interval_text TEXT;
BEGIN
  SELECT * INTO v_schedule
  FROM maintenance_schedules
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_schedule.schedule_type = 'one_time' THEN
    RETURN NULL;
  END IF;

  CASE v_schedule.frequency
    WHEN 'hourly' THEN
      v_interval_text := (v_schedule.frequency_value || ' hours')::TEXT;
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' hours')::INTERVAL;
    WHEN 'daily' THEN
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' days')::INTERVAL;
    WHEN 'weekly' THEN
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' weeks')::INTERVAL;
    WHEN 'monthly' THEN
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' months')::INTERVAL;
    WHEN 'quarterly' THEN
      v_next_date := p_completed_date + (v_schedule.frequency_value * 3 || ' months')::INTERVAL;
    WHEN 'yearly' THEN
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' years')::INTERVAL;
    ELSE
      v_next_date := p_completed_date + (v_schedule.frequency_value || ' days')::INTERVAL;
  END CASE;

  IF v_schedule.end_date IS NOT NULL AND v_next_date > v_schedule.end_date THEN
    RETURN NULL;
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM maintenance_recurring_exceptions
    WHERE schedule_id = p_schedule_id
    AND exception_date = v_next_date
    AND rescheduled_to IS NULL
  ) LOOP
    v_next_date := v_next_date + (v_schedule.frequency_value || ' days')::INTERVAL;
  END LOOP;

  RETURN v_next_date;
END;
$$;

-- Function to check for overdue maintenance
CREATE OR REPLACE FUNCTION public.check_overdue_maintenance()
RETURNS TABLE(schedule_id UUID, vehicle_id UUID, title TEXT, days_overdue INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.id,
    ms.vehicle_id,
    ms.title,
    (CURRENT_DATE - ms.next_due_date)::INTEGER AS days_overdue
  FROM maintenance_schedules ms
  WHERE ms.is_active = true
    AND ms.next_due_date < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM maintenance_schedule_history msh
      WHERE msh.schedule_id = ms.id
        AND msh.status = 'completed'
        AND msh.completed_date::DATE >= ms.next_due_date
    )
  ORDER BY ms.priority DESC, days_overdue DESC;
END;
$$;

-- Function to generate maintenance alerts
CREATE OR REPLACE FUNCTION public.generate_maintenance_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_alert_hour INTEGER;
  v_hours_until NUMERIC;
  v_alert_count INTEGER := 0;
  v_recipient JSONB;
BEGIN
  FOR v_schedule IN
    SELECT * FROM maintenance_schedules
    WHERE is_active = true
      AND next_due_date IS NOT NULL
      AND next_due_date >= CURRENT_DATE
  LOOP
    v_hours_until := EXTRACT(EPOCH FROM (v_schedule.next_due_date::TIMESTAMP - NOW())) / 3600;

    FOREACH v_alert_hour IN ARRAY v_schedule.alert_before_hours
    LOOP
      IF v_hours_until <= v_alert_hour AND v_hours_until > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM maintenance_alerts
          WHERE schedule_id = v_schedule.id
            AND alert_type = 'upcoming'
            AND hours_until_due BETWEEN v_alert_hour - 1 AND v_alert_hour + 1
            AND delivery_status IN ('sent', 'delivered', 'acknowledged')
        ) THEN
          FOR v_recipient IN SELECT * FROM jsonb_array_elements(v_schedule.notification_recipients)
          LOOP
            INSERT INTO maintenance_alerts (
              schedule_id,
              alert_type,
              alert_time,
              due_date,
              hours_until_due,
              notification_method,
              recipient_email,
              recipient_phone,
              recipient_name
            ) VALUES (
              v_schedule.id,
              'upcoming',
              NOW(),
              v_schedule.next_due_date,
              v_hours_until,
              CASE 
                WHEN (v_schedule.notification_channels->>'email')::BOOLEAN THEN 'email'::maintenance_notification_method
                WHEN (v_schedule.notification_channels->>'in_app')::BOOLEAN THEN 'in_app'::maintenance_notification_method
                ELSE 'all'::maintenance_notification_method
              END,
              v_recipient->>'email',
              v_recipient->>'phone',
              v_recipient->>'name'
            );
            v_alert_count := v_alert_count + 1;
          END LOOP;
        END IF;
      END IF;
    END LOOP;

    IF v_hours_until < 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM maintenance_alerts
        WHERE schedule_id = v_schedule.id
          AND alert_type = 'overdue'
          AND DATE(alert_time) = CURRENT_DATE
      ) THEN
        FOR v_recipient IN SELECT * FROM jsonb_array_elements(v_schedule.notification_recipients)
        LOOP
          INSERT INTO maintenance_alerts (
            schedule_id,
            alert_type,
            alert_time,
            due_date,
            hours_until_due,
            notification_method,
            recipient_email,
            recipient_phone,
            recipient_name
          ) VALUES (
            v_schedule.id,
            'overdue',
            NOW(),
            v_schedule.next_due_date,
            v_hours_until,
            'all',
            v_recipient->>'email',
            v_recipient->>'phone',
            v_recipient->>'name'
          );
          v_alert_count := v_alert_count + 1;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN v_alert_count;
END;
$$;

-- Trigger function to update next_due_date when maintenance is completed
CREATE OR REPLACE FUNCTION public.on_maintenance_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_date DATE;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_next_date := calculate_next_due_date(NEW.schedule_id, NEW.completed_date::DATE);
    
    UPDATE maintenance_schedules
    SET 
      last_completed_date = NEW.completed_date::DATE,
      next_due_date = v_next_date,
      last_odometer_reading = COALESCE(NEW.odometer_reading, last_odometer_reading),
      updated_at = NOW()
    WHERE id = NEW.schedule_id;

    INSERT INTO maintenance_alerts (
      schedule_id,
      alert_type,
      alert_time,
      due_date,
      hours_until_due,
      notification_method,
      delivery_status
    ) VALUES (
      NEW.schedule_id,
      'completed',
      NOW(),
      NEW.scheduled_date,
      0,
      'in_app',
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_maintenance_complete
AFTER UPDATE ON public.maintenance_schedule_history
FOR EACH ROW
EXECUTE FUNCTION public.on_maintenance_complete();

-- Trigger to auto-update updated_at
CREATE TRIGGER update_maintenance_schedules_updated_at
BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_history_updated_at
BEFORE UPDATE ON public.maintenance_schedule_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_recurring_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view maintenance schedules"
ON public.maintenance_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage maintenance schedules"
ON public.maintenance_schedules FOR ALL
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to view maintenance history"
ON public.maintenance_schedule_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage maintenance history"
ON public.maintenance_schedule_history FOR ALL
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to view maintenance alerts"
ON public.maintenance_alerts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage maintenance alerts"
ON public.maintenance_alerts FOR ALL
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to view maintenance exceptions"
ON public.maintenance_recurring_exceptions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage maintenance exceptions"
ON public.maintenance_recurring_exceptions FOR ALL
TO authenticated
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_schedule_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_alerts;