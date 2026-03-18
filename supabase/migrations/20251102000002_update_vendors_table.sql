-- Update existing vendors table for vendor management
-- The table already exists, we just need to ensure it has the right structure

-- Add master_email column if it doesn't exist (for user filtering)
DO $
$
BEGIN
  IF NOT EXISTS (
    SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vendors'
    AND column_name = 'master_email'
  ) THEN
  ALTER TABLE public.vendors ADD COLUMN master_email TEXT;
END
IF;
END $$;

-- Create indexes for better performance if they don't exist
CREATE INDEX
IF NOT EXISTS idx_vendors_master_email ON public.vendors
(master_email);
CREATE INDEX
IF NOT EXISTS idx_vendors_vendor_number ON public.vendors
(vendor_number);
CREATE INDEX
IF NOT EXISTS idx_vendors_name ON public.vendors
(name);

-- Update comment
COMMENT ON TABLE public.vendors IS 'Stores vendor/supplier information for inventory management';
