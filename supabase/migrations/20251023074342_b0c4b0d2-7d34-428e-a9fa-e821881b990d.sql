-- Create inspector_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inspector_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  employee_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for inspector_profiles (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspector_profiles') THEN
    CREATE INDEX IF NOT EXISTS idx_inspector_profiles_user_id ON public.inspector_profiles(user_id);
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inspector_profiles' AND column_name = 'employee_id') THEN
      CREATE INDEX IF NOT EXISTS idx_inspector_profiles_employee_id ON public.inspector_profiles(employee_id);
    END IF;
  END IF;
END $$;

-- Enable RLS for inspector_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspector_profiles') THEN
    ALTER TABLE public.inspector_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add RLS policies for inspector_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspector_profiles') THEN
    DROP POLICY IF EXISTS "Inspector profiles are viewable by authenticated users" ON public.inspector_profiles;
    CREATE POLICY "Inspector profiles are viewable by authenticated users" 
      ON public.inspector_profiles FOR SELECT 
      TO authenticated 
      USING (true);

    DROP POLICY IF EXISTS "Inspector profiles are insertable by authenticated users" ON public.inspector_profiles;
    CREATE POLICY "Inspector profiles are insertable by authenticated users" 
      ON public.inspector_profiles FOR INSERT 
      TO authenticated 
      WITH CHECK (true);

    DROP POLICY IF EXISTS "Inspector profiles are updatable by authenticated users" ON public.inspector_profiles;
    CREATE POLICY "Inspector profiles are updatable by authenticated users" 
      ON public.inspector_profiles FOR UPDATE 
      TO authenticated 
      USING (true);
  END IF;
END $$;

-- Add new fields to vehicle_inspections if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_inspections' AND column_name = 'initiated_via') THEN
    ALTER TABLE public.vehicle_inspections ADD COLUMN initiated_via TEXT DEFAULT 'manual';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_inspections' AND column_name = 'scanned_vehicle_qr') THEN
    ALTER TABLE public.vehicle_inspections ADD COLUMN scanned_vehicle_qr TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_inspections' AND column_name = 'inspector_profile_id') THEN
    ALTER TABLE public.vehicle_inspections ADD COLUMN inspector_profile_id UUID REFERENCES public.inspector_profiles(id);
  END IF;
END $$;

-- Add qr_code_value to vehicles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'qr_code_value') THEN
    ALTER TABLE public.vehicles ADD COLUMN qr_code_value TEXT;
  END IF;
END $$;

-- Add index for qr_code_value for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_qr_code_value ON public.vehicles(qr_code_value);