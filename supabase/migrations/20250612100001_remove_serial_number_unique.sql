-- Remove the unique constraint on serial_number in tyres table
-- Serial numbers should not be required to be unique since:
-- 1. Many tyres may not have serial numbers (null values)
-- 2. In some cases, serial numbers might legitimately be reused or shared

ALTER TABLE tyres DROP CONSTRAINT IF EXISTS tyres_serial_number_key;

-- Also remove any unique index if it exists
DROP INDEX IF EXISTS tyres_serial_number_key;
DROP INDEX IF EXISTS idx_tyres_serial_number;
