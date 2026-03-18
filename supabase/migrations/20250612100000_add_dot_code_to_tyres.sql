-- Add dot_code column to tyres table
-- This allows storing DOT codes for manually installed tyres (not from inventory)

ALTER TABLE tyres
ADD COLUMN
IF NOT EXISTS dot_code TEXT;

-- Add index for DOT code lookups
CREATE INDEX
IF NOT EXISTS idx_tyres_dot_code ON tyres
(dot_code);

-- Comment for documentation
COMMENT ON COLUMN tyres.dot_code IS 'DOT code for the tyre, either from tyre_inventory or manually entered';
