-- Drop the UNIQUE constraint on tyres.serial_number.
--
-- Background:
--   * 20250612100001_remove_serial_number_unique.sql previously dropped this
--     constraint, but 20260205100000_import_fleet_tyre_positions.sql re-added
--     it as `tyres_serial_number_key UNIQUE (serial_number)`.
--   * In practice the business allows (and sometimes requires) the serial
--     number to equal the DOT code, and the same serial may legitimately
--     appear on more than one tyre record. The unique constraint blocks
--     routine updates with a 23505 error.
--
-- This migration removes the constraint and replaces it with a plain
-- (non-unique) index so lookups by serial_number remain fast.

ALTER TABLE tyres DROP CONSTRAINT IF EXISTS tyres_serial_number_key;
DROP INDEX IF EXISTS tyres_serial_number_key;

CREATE INDEX IF NOT EXISTS idx_tyres_serial_number
  ON tyres (serial_number)
  WHERE serial_number IS NOT NULL;
