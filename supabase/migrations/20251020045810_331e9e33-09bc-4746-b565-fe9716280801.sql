-- Update missed_loads table to support customer retention tracking
-- Add new columns for comprehensive missed load tracking

ALTER TABLE public.missed_loads
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS load_request_date DATE,
ADD COLUMN IF NOT EXISTS requested_pickup_date DATE,
ADD COLUMN IF NOT EXISTS requested_delivery_date DATE,
ADD COLUMN IF NOT EXISTS route TEXT,
ADD COLUMN IF NOT EXISTS estimated_revenue NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR',
ADD COLUMN IF NOT EXISTS reason_description TEXT,
ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS competitor_won BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS recorded_by TEXT,
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_by TEXT,
ADD COLUMN IF NOT EXISTS compensation_offered NUMERIC,
ADD COLUMN IF NOT EXISTS compensation_notes TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_missed_loads_customer_name ON public.missed_loads(customer_name);
CREATE INDEX IF NOT EXISTS idx_missed_loads_resolution_status ON public.missed_loads(resolution_status);
CREATE INDEX IF NOT EXISTS idx_missed_loads_recorded_at ON public.missed_loads(recorded_at);
CREATE INDEX IF NOT EXISTS idx_missed_loads_currency ON public.missed_loads(currency);

-- Add check constraint for valid resolution status
ALTER TABLE public.missed_loads
DROP CONSTRAINT IF EXISTS missed_loads_resolution_status_check;

ALTER TABLE public.missed_loads
ADD CONSTRAINT missed_loads_resolution_status_check 
CHECK (resolution_status IN ('pending', 'resolved', 'lost_opportunity', 'rescheduled'));

-- Add check constraint for valid impact level
ALTER TABLE public.missed_loads
DROP CONSTRAINT IF EXISTS missed_loads_impact_check;

ALTER TABLE public.missed_loads
ADD CONSTRAINT missed_loads_impact_check 
CHECK (impact IN ('low', 'medium', 'high'));

-- Add check constraint for valid currency
ALTER TABLE public.missed_loads
DROP CONSTRAINT IF EXISTS missed_loads_currency_check;

ALTER TABLE public.missed_loads
ADD CONSTRAINT missed_loads_currency_check 
CHECK (currency IN ('ZAR', 'USD'));

COMMENT ON TABLE public.missed_loads IS 'Tracks missed business opportunities and load requests that could not be fulfilled';
COMMENT ON COLUMN public.missed_loads.customer_name IS 'Name of the customer who requested the load';
COMMENT ON COLUMN public.missed_loads.resolution_status IS 'Current status: pending, resolved, lost_opportunity, rescheduled';
COMMENT ON COLUMN public.missed_loads.impact IS 'Business impact level: low, medium, high';
COMMENT ON COLUMN public.missed_loads.competitor_won IS 'Flag indicating if competitor won this load';
COMMENT ON COLUMN public.missed_loads.compensation_offered IS 'Compensation amount offered to customer (if any)';