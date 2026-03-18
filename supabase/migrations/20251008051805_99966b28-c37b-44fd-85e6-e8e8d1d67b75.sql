-- Create fleet-specific tyre tables
CREATE TABLE IF NOT EXISTS public.fleet_33h_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_6h_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_3t_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_6f_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_7f_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_8f_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_ud_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_14l_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

CREATE TABLE IF NOT EXISTS public.fleet_15l_tyres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(registration_no, position)
);

-- Add fleet_number column to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS fleet_number TEXT;

-- Enable RLS on all fleet tables
ALTER TABLE public.fleet_33h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_6h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_3t_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_6f_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_7f_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_8f_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_ud_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_14l_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_15l_tyres ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to view fleet 33h tyres" 
ON public.fleet_33h_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 33h tyres" 
ON public.fleet_33h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 6h tyres" 
ON public.fleet_6h_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 6h tyres" 
ON public.fleet_6h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 3t tyres" 
ON public.fleet_3t_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 3t tyres" 
ON public.fleet_3t_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 6f tyres" 
ON public.fleet_6f_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 6f tyres" 
ON public.fleet_6f_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 7f tyres" 
ON public.fleet_7f_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 7f tyres" 
ON public.fleet_7f_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 8f tyres" 
ON public.fleet_8f_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 8f tyres" 
ON public.fleet_8f_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet ud tyres" 
ON public.fleet_ud_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet ud tyres" 
ON public.fleet_ud_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 14l tyres" 
ON public.fleet_14l_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 14l tyres" 
ON public.fleet_14l_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 15l tyres" 
ON public.fleet_15l_tyres FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage fleet 15l tyres" 
ON public.fleet_15l_tyres FOR ALL USING (true);

-- Insert sample data from SQL files
INSERT INTO public.fleet_33h_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V1', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V10', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V2', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V3', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V4', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V5', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V6', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V7', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V8', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701'), 
('V9', 'JFK963FS', 'NEW_CODE_33H', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_6h_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V1', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V2', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V3', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V4', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V5', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701'), 
('V6', 'ABJ3739', 'NEW_CODE_6H', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_3t_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T1', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T10', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T11', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T12', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T13', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T14', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T15', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T16', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T2', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T3', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T4', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T5', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T6', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T7', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T8', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701'), 
('T9', 'ACZ3360/ACZ3361', 'NEW_CODE_3T', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_6f_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T1', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T2', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T3', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T4', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T5', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701'), 
('T6', 'LR93LPGP', 'NEW_CODE_6F', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_7f_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T1', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T2', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T3', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T4', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T5', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701'), 
('T6', 'LX08PLGP', 'NEW_CODE_7F', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_8f_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T1', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T2', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T3', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T4', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T5', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T6', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T7', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701'), 
('T8', 'AGK1234', 'NEW_CODE_8F', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_ud_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V1', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V2', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V3', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V4', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V5', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701'), 
('V6', 'ACO8468', 'NEW_CODE_UD', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_14l_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'ABA3918', 'NEW_CODE_14L', '2025-10-01 07:14:12.486701'), 
('V1', 'ABA3918', 'NEW_CODE_14L', '2025-10-01 07:14:12.486701'), 
('V2', 'ABA3918', 'NEW_CODE_14L', '2025-10-01 07:14:12.486701'), 
('V3', 'ABA3918', 'NEW_CODE_14L', '2025-10-01 07:14:12.486701'), 
('V4', 'ABA3918', 'NEW_CODE_14L', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;

INSERT INTO public.fleet_15l_tyres (position, registration_no, tyre_code, updated_at) VALUES 
('SP', 'AAX2987', 'NEW_CODE_15L', '2025-10-01 07:14:12.486701'), 
('V1', 'AAX2987', 'NEW_CODE_15L', '2025-10-01 07:14:12.486701'), 
('V2', 'AAX2987', 'NEW_CODE_15L', '2025-10-01 07:14:12.486701'), 
('V3', 'AAX2987', 'NEW_CODE_15L', '2025-10-01 07:14:12.486701'), 
('V4', 'AAX2987', 'NEW_CODE_15L', '2025-10-01 07:14:12.486701')
ON CONFLICT (registration_no, position) DO NOTHING;