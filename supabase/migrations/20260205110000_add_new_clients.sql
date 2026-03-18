-- Migration: Add new clients to the clients table
-- Date: 2026-02-05
-- Description: Insert new client records if they don't already exist

INSERT INTO clients (name, active)
VALUES
  ('AVEMEL', true),
  ('BOLSBURY TRADING CC', true),
  ('CHEP', true),
  ('CONCARGO', true),
  ('CRYSTAL CANDY', true),
  ('DEEPCATCH', true),
  ('DP WORLD', true),
  ('DS HEALTH', true),
  ('ESMTRANS', true),
  ('FEEDMIX', true),
  ('FREIGHT CO', true),
  ('FX LOGISTICS', true),
  ('GUNDO FREIGHT', true),
  ('HFR', true),
  ('KROOTS', true),
  ('MASSMART', true),
  ('MATANUSKA PTY LTD', true),
  ('MZANTSI SOLUTIONS', true),
  ('PLUS ZERO', true),
  ('RDW', true),
  ('STEINWEG', true),
  ('TERALCO', true),
  ('TRADE CLEAR LOGISTICS', true),
  ('EMPTY KM', true)
ON CONFLICT (name) DO NOTHING;

-- Summary
DO $$
DECLARE
  client_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO client_count FROM clients WHERE active = true;
  RAISE NOTICE 'Total active clients: %', client_count;
END $$;
