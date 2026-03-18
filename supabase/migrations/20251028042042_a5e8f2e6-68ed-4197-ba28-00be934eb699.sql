-- Create fleet tables for 33H-type horse fleets (V1-V10 + SP)
CREATE TABLE IF NOT EXISTS public.fleet_21h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_22h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_23h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_24h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_26h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_28h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_29h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_30h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_31h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_32h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fleet tables for 6H-type horse fleets (V1-V6 + SP)
CREATE TABLE IF NOT EXISTS public.fleet_1h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_4h_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fleet tables for 3T-type interlink trailers (T1-T16 + SP)
CREATE TABLE IF NOT EXISTS public.fleet_1t_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_2t_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_4t_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fleet tables for 7F-type reefer trailers (T1-T6 + SP)
CREATE TABLE IF NOT EXISTS public.fleet_4f_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_5f_tyres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  tyre_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.fleet_21h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_22h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_23h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_24h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_26h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_28h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_29h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_30h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_31h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_32h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_1h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_4h_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_1t_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_2t_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_4t_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_4f_tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_5f_tyres ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all new tables
CREATE POLICY "Allow authenticated users to view fleet 21h tyres" ON public.fleet_21h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 21h tyres" ON public.fleet_21h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 22h tyres" ON public.fleet_22h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 22h tyres" ON public.fleet_22h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 23h tyres" ON public.fleet_23h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 23h tyres" ON public.fleet_23h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 24h tyres" ON public.fleet_24h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 24h tyres" ON public.fleet_24h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 26h tyres" ON public.fleet_26h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 26h tyres" ON public.fleet_26h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 28h tyres" ON public.fleet_28h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 28h tyres" ON public.fleet_28h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 29h tyres" ON public.fleet_29h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 29h tyres" ON public.fleet_29h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 30h tyres" ON public.fleet_30h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 30h tyres" ON public.fleet_30h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 31h tyres" ON public.fleet_31h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 31h tyres" ON public.fleet_31h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 32h tyres" ON public.fleet_32h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 32h tyres" ON public.fleet_32h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 1h tyres" ON public.fleet_1h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 1h tyres" ON public.fleet_1h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 4h tyres" ON public.fleet_4h_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 4h tyres" ON public.fleet_4h_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 1t tyres" ON public.fleet_1t_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 1t tyres" ON public.fleet_1t_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 2t tyres" ON public.fleet_2t_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 2t tyres" ON public.fleet_2t_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 4t tyres" ON public.fleet_4t_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 4t tyres" ON public.fleet_4t_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 4f tyres" ON public.fleet_4f_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 4f tyres" ON public.fleet_4f_tyres FOR ALL USING (true);

CREATE POLICY "Allow authenticated users to view fleet 5f tyres" ON public.fleet_5f_tyres FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to manage fleet 5f tyres" ON public.fleet_5f_tyres FOR ALL USING (true);