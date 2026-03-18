-- Migration Part 1: Add enum values ONLY
-- Purpose: Add new status values to load_status enum
-- NOTE: This MUST be run separately BEFORE the main migration

-- Add enum values one at a time (each in its own transaction when run)
-- Run these separately or the view creation will fail

ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'arrived_at_loading';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'loading';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'loading_completed';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'arrived_at_delivery';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'offloading';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'offloading_completed';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'completed';
ALTER TYPE load_status
ADD VALUE
IF NOT EXISTS 'on_hold';
