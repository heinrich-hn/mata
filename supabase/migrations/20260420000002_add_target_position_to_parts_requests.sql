ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS target_position TEXT;

COMMENT ON COLUMN parts_requests.target_position IS 'Target vehicle tyre position (e.g. V3, T5) for tyre job card requests';
