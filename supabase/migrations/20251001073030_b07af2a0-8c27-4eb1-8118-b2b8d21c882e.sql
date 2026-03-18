-- Create trips table for fleet operations management
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number text UNIQUE NOT NULL,
  driver_name text,
  vehicle_id uuid REFERENCES public.vehicles(id),
  client_name text,
  client_type text DEFAULT 'external',
  origin text,
  destination text,
  distance_km numeric,
  departure_date date,
  arrival_date date,
  status text DEFAULT 'active',
  payment_status text DEFAULT 'unpaid',
  payment_amount numeric,
  payment_received_date date,
  payment_method text,
  payment_notes text,
  bank_reference text,
  invoice_submitted_date date,
  invoice_number text,
  completed_at date,
  completed_by text,
  auto_completed_at timestamptz,
  auto_completed_reason text,
  additional_costs jsonb DEFAULT '[]'::jsonb,
  delay_reasons jsonb DEFAULT '[]'::jsonb,
  follow_up_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cost entries table for trip expenses
CREATE TABLE public.cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  category text NOT NULL,
  sub_category text,
  amount numeric NOT NULL,
  currency text DEFAULT 'ZAR',
  reference_number text,
  date date NOT NULL,
  notes text,
  is_flagged boolean DEFAULT false,
  is_system_generated boolean DEFAULT false,
  flag_reason text,
  investigation_notes text,
  investigation_status text,
  resolved_at timestamptz,
  resolved_by text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create diesel consumption records table
CREATE TABLE public.diesel_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id),
  fleet_number text NOT NULL,
  driver_name text,
  fuel_station text NOT NULL,
  litres_filled numeric NOT NULL,
  total_cost numeric NOT NULL,
  cost_per_litre numeric,
  km_reading integer NOT NULL,
  date date NOT NULL,
  currency text DEFAULT 'ZAR',
  notes text,
  debrief_date date,
  debrief_notes text,
  debrief_signed_by text,
  debrief_signed_at timestamptz,
  is_probe_verified boolean DEFAULT false,
  probe_verification_date date,
  probe_verification_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create driver behavior events table
CREATE TABLE public.driver_behavior_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name text NOT NULL,
  event_type text NOT NULL,
  event_date date NOT NULL,
  event_time time,
  location text,
  fleet_number text,
  severity text DEFAULT 'medium',
  points integer DEFAULT 0,
  description text NOT NULL,
  witness_name text,
  witness_statement text,
  corrective_action_taken text,
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  status text DEFAULT 'open',
  car_report_id uuid,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create action items table for task management
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'open',
  category text,
  assigned_to text,
  due_date date,
  completed_date date,
  related_entity_type text,
  related_entity_id text,
  comments jsonb DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create CAR reports table (Corrective Action Reports)
CREATE TABLE public.car_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text UNIQUE NOT NULL,
  driver_name text NOT NULL,
  fleet_number text,
  incident_date date NOT NULL,
  incident_time time,
  incident_location text,
  incident_type text NOT NULL,
  severity text DEFAULT 'medium',
  description text NOT NULL,
  immediate_action_taken text,
  root_cause_analysis text,
  corrective_actions text,
  preventive_measures text,
  responsible_person text,
  target_completion_date date,
  actual_completion_date date,
  status text DEFAULT 'open',
  reference_event_id uuid,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create missed loads table
CREATE TABLE public.missed_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_reference text NOT NULL,
  client_name text NOT NULL,
  scheduled_date date NOT NULL,
  missed_date date NOT NULL,
  reason text NOT NULL,
  reason_category text,
  responsible_party text,
  estimated_loss numeric,
  actual_loss numeric,
  currency text DEFAULT 'ZAR',
  recovery_plan text,
  status text DEFAULT 'open',
  resolved_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diesel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missed_loads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to view trips"
  ON public.trips FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage trips"
  ON public.trips FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view cost entries"
  ON public.cost_entries FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage cost entries"
  ON public.cost_entries FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view diesel records"
  ON public.diesel_records FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage diesel records"
  ON public.diesel_records FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view driver behavior events"
  ON public.driver_behavior_events FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage driver behavior events"
  ON public.driver_behavior_events FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view action items"
  ON public.action_items FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage action items"
  ON public.action_items FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view CAR reports"
  ON public.car_reports FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage CAR reports"
  ON public.car_reports FOR ALL
  USING (true);

CREATE POLICY "Allow authenticated users to view missed loads"
  ON public.missed_loads FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage missed loads"
  ON public.missed_loads FOR ALL
  USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_entries_updated_at
  BEFORE UPDATE ON public.cost_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diesel_records_updated_at
  BEFORE UPDATE ON public.diesel_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_driver_behavior_events_updated_at
  BEFORE UPDATE ON public.driver_behavior_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_car_reports_updated_at
  BEFORE UPDATE ON public.car_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_missed_loads_updated_at
  BEFORE UPDATE ON public.missed_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_trips_vehicle_id ON public.trips(vehicle_id);
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_driver_name ON public.trips(driver_name);
CREATE INDEX idx_trips_departure_date ON public.trips(departure_date);

CREATE INDEX idx_cost_entries_trip_id ON public.cost_entries(trip_id);
CREATE INDEX idx_cost_entries_category ON public.cost_entries(category);
CREATE INDEX idx_cost_entries_date ON public.cost_entries(date);
CREATE INDEX idx_cost_entries_is_flagged ON public.cost_entries(is_flagged);

CREATE INDEX idx_diesel_records_trip_id ON public.diesel_records(trip_id);
CREATE INDEX idx_diesel_records_fleet_number ON public.diesel_records(fleet_number);
CREATE INDEX idx_diesel_records_date ON public.diesel_records(date);

CREATE INDEX idx_driver_behavior_events_driver_name ON public.driver_behavior_events(driver_name);
CREATE INDEX idx_driver_behavior_events_event_date ON public.driver_behavior_events(event_date);
CREATE INDEX idx_driver_behavior_events_status ON public.driver_behavior_events(status);

CREATE INDEX idx_action_items_assigned_to ON public.action_items(assigned_to);
CREATE INDEX idx_action_items_status ON public.action_items(status);
CREATE INDEX idx_action_items_due_date ON public.action_items(due_date);

CREATE INDEX idx_car_reports_driver_name ON public.car_reports(driver_name);
CREATE INDEX idx_car_reports_incident_date ON public.car_reports(incident_date);
CREATE INDEX idx_car_reports_status ON public.car_reports(status);

CREATE INDEX idx_missed_loads_client_name ON public.missed_loads(client_name);
CREATE INDEX idx_missed_loads_scheduled_date ON public.missed_loads(scheduled_date);

-- Enable realtime for operations tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diesel_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_behavior_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.car_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missed_loads;