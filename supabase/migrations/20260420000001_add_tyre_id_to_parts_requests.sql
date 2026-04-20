-- Add tyre_id column to parts_requests for linking tyre inventory items to job cards
ALTER TABLE parts_requests
  ADD COLUMN tyre_id UUID REFERENCES tyres(id);

-- Add index for efficient lookups
CREATE INDEX idx_parts_requests_tyre_id ON parts_requests(tyre_id) WHERE tyre_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN parts_requests.tyre_id IS 'References a tyre from the holding bay (tyres table) when the part request is for a tyre job card';
