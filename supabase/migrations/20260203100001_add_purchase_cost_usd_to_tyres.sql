-- Add purchase_cost_usd column to tyres table for bay tyre management
-- Tyres added to bays (Holding Bay, Retread Bay) will use USD pricing

ALTER TABLE tyres ADD COLUMN
IF NOT EXISTS purchase_cost_usd NUMERIC;

COMMENT ON COLUMN tyres.purchase_cost_usd IS 'Purchase cost in USD. Used for tyres added directly to storage bays.';

-- Add index for cost tracking queries
CREATE INDEX
IF NOT EXISTS idx_tyres_purchase_cost_usd ON tyres
(purchase_cost_usd) WHERE purchase_cost_usd IS NOT NULL;
