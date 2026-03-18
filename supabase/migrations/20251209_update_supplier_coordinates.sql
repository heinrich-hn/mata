-- Update Diesel Suppliers with Coordinates
-- This script adds latitude/longitude to existing suppliers
-- Run this in Supabase SQL Editor

-- First, let's see what suppliers exist without coordinates
-- SELECT id, name, location, province, latitude, longitude
-- FROM diesel_suppliers
-- WHERE latitude IS NULL OR longitude IS NULL;

-- ============================================
-- SOUTH AFRICA - Major Fuel Stations
-- ============================================

-- Johannesburg Area
UPDATE diesel_suppliers SET latitude = -26.2041, longitude = 28.0473
WHERE LOWER(name) LIKE '%johannesburg%' OR LOWER(location) LIKE '%johannesburg%'
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -26.1052, longitude = 28.0560
WHERE LOWER(name) LIKE '%sandton%' OR LOWER(location) LIKE '%sandton%'
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -26.0884, longitude = 28.0900
WHERE (LOWER(name) LIKE '%midrand%' OR LOWER(location) LIKE '%midrand%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -26.1418, longitude = 28.2509
WHERE (LOWER(name) LIKE '%kempton%' OR LOWER(location) LIKE '%kempton park%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -26.1958, longitude = 28.3072
WHERE (LOWER(name) LIKE '%benoni%' OR LOWER(location) LIKE '%benoni%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -26.2580, longitude = 28.1313
WHERE (LOWER(name) LIKE '%germiston%' OR LOWER(location) LIKE '%germiston%')
  AND latitude IS NULL;

-- Pretoria Area
UPDATE diesel_suppliers SET latitude = -25.7479, longitude = 28.2293
WHERE (LOWER(name) LIKE '%pretoria%' OR LOWER(location) LIKE '%pretoria%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -25.7802, longitude = 28.2775
WHERE (LOWER(name) LIKE '%centurion%' OR LOWER(location) LIKE '%centurion%')
  AND latitude IS NULL;

-- Durban Area
UPDATE diesel_suppliers SET latitude = -29.8587, longitude = 31.0218
WHERE (LOWER(name) LIKE '%durban%' OR LOWER(location) LIKE '%durban%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -29.7886, longitude = 31.0292
WHERE (LOWER(name) LIKE '%umhlanga%' OR LOWER(location) LIKE '%umhlanga%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -29.8491, longitude = 30.9784
WHERE (LOWER(name) LIKE '%pinetown%' OR LOWER(location) LIKE '%pinetown%')
  AND latitude IS NULL;

-- Cape Town Area
UPDATE diesel_suppliers SET latitude = -33.9249, longitude = 18.4241
WHERE (LOWER(name) LIKE '%cape town%' OR LOWER(location) LIKE '%cape town%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -33.9042, longitude = 18.4174
WHERE (LOWER(name) LIKE '%bellville%' OR LOWER(location) LIKE '%bellville%')
  AND latitude IS NULL;

UPDATE diesel_suppliers SET latitude = -34.0758, longitude = 18.8605
WHERE (LOWER(name) LIKE '%somerset west%' OR LOWER(location) LIKE '%somerset west%')
  AND latitude IS NULL;

-- Port Elizabeth / Gqeberha
UPDATE diesel_suppliers SET latitude = -33.9608, longitude = 25.6022
WHERE (LOWER(name) LIKE '%port elizabeth%' OR LOWER(name) LIKE '%gqeberha%'
  OR LOWER(location) LIKE '%port elizabeth%' OR LOWER(location) LIKE '%gqeberha%')
  AND latitude IS NULL;

-- Bloemfontein
UPDATE diesel_suppliers SET latitude = -29.0852, longitude = 26.1596
WHERE (LOWER(name) LIKE '%bloemfontein%' OR LOWER(location) LIKE '%bloemfontein%')
  AND latitude IS NULL;

-- Polokwane (Pietersburg)
UPDATE diesel_suppliers SET latitude = -23.9045, longitude = 29.4689
WHERE (LOWER(name) LIKE '%polokwane%' OR LOWER(name) LIKE '%pietersburg%'
  OR LOWER(location) LIKE '%polokwane%' OR LOWER(location) LIKE '%pietersburg%')
  AND latitude IS NULL;

-- Nelspruit / Mbombela
UPDATE diesel_suppliers SET latitude = -25.4653, longitude = 30.9785
WHERE (LOWER(name) LIKE '%nelspruit%' OR LOWER(name) LIKE '%mbombela%'
  OR LOWER(location) LIKE '%nelspruit%' OR LOWER(location) LIKE '%mbombela%')
  AND latitude IS NULL;

-- Witbank / Emalahleni
UPDATE diesel_suppliers SET latitude = -25.8677, longitude = 29.2331
WHERE (LOWER(name) LIKE '%witbank%' OR LOWER(name) LIKE '%emalahleni%'
  OR LOWER(location) LIKE '%witbank%' OR LOWER(location) LIKE '%emalahleni%')
  AND latitude IS NULL;

-- Rustenburg
UPDATE diesel_suppliers SET latitude = -25.6670, longitude = 27.2419
WHERE (LOWER(name) LIKE '%rustenburg%' OR LOWER(location) LIKE '%rustenburg%')
  AND latitude IS NULL;

-- Kimberley
UPDATE diesel_suppliers SET latitude = -28.7382, longitude = 24.7649
WHERE (LOWER(name) LIKE '%kimberley%' OR LOWER(location) LIKE '%kimberley%')
  AND latitude IS NULL;

-- East London
UPDATE diesel_suppliers SET latitude = -32.9674, longitude = 27.8707
WHERE (LOWER(name) LIKE '%east london%' OR LOWER(location) LIKE '%east london%')
  AND latitude IS NULL;

-- Upington
UPDATE diesel_suppliers SET latitude = -28.4572, longitude = 21.2567
WHERE (LOWER(name) LIKE '%upington%' OR LOWER(location) LIKE '%upington%')
  AND latitude IS NULL;

-- Musina (Messina) - Border
UPDATE diesel_suppliers SET latitude = -22.3475, longitude = 29.9930
WHERE (LOWER(name) LIKE '%musina%' OR LOWER(name) LIKE '%messina%'
  OR LOWER(location) LIKE '%musina%' OR LOWER(location) LIKE '%messina%')
  AND latitude IS NULL;

-- Beitbridge Border Area (SA side)
UPDATE diesel_suppliers SET latitude = -22.2153, longitude = 29.9886
WHERE (LOWER(name) LIKE '%beitbridge%' OR LOWER(location) LIKE '%beitbridge%')
  AND latitude IS NULL;

-- Mokopane (Potgietersrus)
UPDATE diesel_suppliers SET latitude = -24.1833, longitude = 29.0167
WHERE (LOWER(name) LIKE '%mokopane%' OR LOWER(name) LIKE '%potgietersrus%'
  OR LOWER(location) LIKE '%mokopane%' OR LOWER(location) LIKE '%potgietersrus%')
  AND latitude IS NULL;

-- Makhado (Louis Trichardt)
UPDATE diesel_suppliers SET latitude = -23.0443, longitude = 29.9060
WHERE (LOWER(name) LIKE '%makhado%' OR LOWER(name) LIKE '%louis trichardt%'
  OR LOWER(location) LIKE '%makhado%' OR LOWER(location) LIKE '%louis trichardt%')
  AND latitude IS NULL;

-- ============================================
-- ZIMBABWE - Major Cities
-- ============================================

-- Harare
UPDATE diesel_suppliers SET latitude = -17.8252, longitude = 31.0335
WHERE (LOWER(name) LIKE '%harare%' OR LOWER(location) LIKE '%harare%')
  AND latitude IS NULL;

-- Bulawayo
UPDATE diesel_suppliers SET latitude = -20.1500, longitude = 28.5833
WHERE (LOWER(name) LIKE '%bulawayo%' OR LOWER(location) LIKE '%bulawayo%')
  AND latitude IS NULL;

-- Mutare
UPDATE diesel_suppliers SET latitude = -18.9707, longitude = 32.6709
WHERE (LOWER(name) LIKE '%mutare%' OR LOWER(location) LIKE '%mutare%')
  AND latitude IS NULL;

-- Gweru
UPDATE diesel_suppliers SET latitude = -19.4500, longitude = 29.8167
WHERE (LOWER(name) LIKE '%gweru%' OR LOWER(location) LIKE '%gweru%')
  AND latitude IS NULL;

-- Kwekwe
UPDATE diesel_suppliers SET latitude = -18.9281, longitude = 29.8147
WHERE (LOWER(name) LIKE '%kwekwe%' OR LOWER(location) LIKE '%kwekwe%')
  AND latitude IS NULL;

-- Masvingo
UPDATE diesel_suppliers SET latitude = -20.0744, longitude = 30.8328
WHERE (LOWER(name) LIKE '%masvingo%' OR LOWER(location) LIKE '%masvingo%')
  AND latitude IS NULL;

-- Victoria Falls
UPDATE diesel_suppliers SET latitude = -17.9243, longitude = 25.8567
WHERE (LOWER(name) LIKE '%victoria falls%' OR LOWER(location) LIKE '%victoria falls%'
  OR LOWER(name) LIKE '%vic falls%' OR LOWER(location) LIKE '%vic falls%')
  AND latitude IS NULL;

-- Hwange
UPDATE diesel_suppliers SET latitude = -18.3664, longitude = 25.9953
WHERE (LOWER(name) LIKE '%hwange%' OR LOWER(location) LIKE '%hwange%')
  AND latitude IS NULL;

-- Beitbridge (ZW side)
UPDATE diesel_suppliers SET latitude = -22.2167, longitude = 30.0000
WHERE (LOWER(name) LIKE '%beitbridge%' OR LOWER(location) LIKE '%beitbridge%')
  AND LOWER(province) LIKE '%matabele%' AND latitude IS NULL;

-- Plumtree
UPDATE diesel_suppliers SET latitude = -20.4833, longitude = 27.8167
WHERE (LOWER(name) LIKE '%plumtree%' OR LOWER(location) LIKE '%plumtree%')
  AND latitude IS NULL;

-- Chinhoyi
UPDATE diesel_suppliers SET latitude = -17.3667, longitude = 30.2000
WHERE (LOWER(name) LIKE '%chinhoyi%' OR LOWER(location) LIKE '%chinhoyi%')
  AND latitude IS NULL;

-- Kadoma
UPDATE diesel_suppliers SET latitude = -18.3500, longitude = 29.9167
WHERE (LOWER(name) LIKE '%kadoma%' OR LOWER(location) LIKE '%kadoma%')
  AND latitude IS NULL;

-- Chegutu
UPDATE diesel_suppliers SET latitude = -18.1300, longitude = 30.1500
WHERE (LOWER(name) LIKE '%chegutu%' OR LOWER(location) LIKE '%chegutu%')
  AND latitude IS NULL;

-- Norton
UPDATE diesel_suppliers SET latitude = -17.8833, longitude = 30.7000
WHERE (LOWER(name) LIKE '%norton%' OR LOWER(location) LIKE '%norton%')
  AND latitude IS NULL;

-- ============================================
-- BOTSWANA - Major Cities
-- ============================================

-- Gaborone
UPDATE diesel_suppliers SET latitude = -24.6282, longitude = 25.9231
WHERE (LOWER(name) LIKE '%gaborone%' OR LOWER(location) LIKE '%gaborone%')
  AND latitude IS NULL;

-- Francistown
UPDATE diesel_suppliers SET latitude = -21.1667, longitude = 27.5000
WHERE (LOWER(name) LIKE '%francistown%' OR LOWER(location) LIKE '%francistown%')
  AND latitude IS NULL;

-- Maun
UPDATE diesel_suppliers SET latitude = -19.9833, longitude = 23.4167
WHERE (LOWER(name) LIKE '%maun%' OR LOWER(location) LIKE '%maun%')
  AND latitude IS NULL;

-- Kasane
UPDATE diesel_suppliers SET latitude = -17.8000, longitude = 25.1500
WHERE (LOWER(name) LIKE '%kasane%' OR LOWER(location) LIKE '%kasane%')
  AND latitude IS NULL;

-- Nata
UPDATE diesel_suppliers SET latitude = -20.2167, longitude = 26.2333
WHERE (LOWER(name) LIKE '%nata%' OR LOWER(location) LIKE '%nata%')
  AND latitude IS NULL;

-- ============================================
-- MOZAMBIQUE - Major Cities
-- ============================================

-- Maputo
UPDATE diesel_suppliers SET latitude = -25.9653, longitude = 32.5892
WHERE (LOWER(name) LIKE '%maputo%' OR LOWER(location) LIKE '%maputo%')
  AND latitude IS NULL;

-- Beira
UPDATE diesel_suppliers SET latitude = -19.8436, longitude = 34.8389
WHERE (LOWER(name) LIKE '%beira%' OR LOWER(location) LIKE '%beira%')
  AND latitude IS NULL;

-- ============================================
-- NAMIBIA - Major Cities
-- ============================================

-- Windhoek
UPDATE diesel_suppliers SET latitude = -22.5594, longitude = 17.0832
WHERE (LOWER(name) LIKE '%windhoek%' OR LOWER(location) LIKE '%windhoek%')
  AND latitude IS NULL;

-- Walvis Bay
UPDATE diesel_suppliers SET latitude = -22.9575, longitude = 14.5053
WHERE (LOWER(name) LIKE '%walvis bay%' OR LOWER(location) LIKE '%walvis bay%')
  AND latitude IS NULL;

-- ============================================
-- ZAMBIA - Major Cities
-- ============================================

-- Lusaka
UPDATE diesel_suppliers SET latitude = -15.3875, longitude = 28.3228
WHERE (LOWER(name) LIKE '%lusaka%' OR LOWER(location) LIKE '%lusaka%')
  AND latitude IS NULL;

-- Livingstone
UPDATE diesel_suppliers SET latitude = -17.8419, longitude = 25.8544
WHERE (LOWER(name) LIKE '%livingstone%' OR LOWER(location) LIKE '%livingstone%')
  AND latitude IS NULL;

-- Ndola
UPDATE diesel_suppliers SET latitude = -12.9587, longitude = 28.6366
WHERE (LOWER(name) LIKE '%ndola%' OR LOWER(location) LIKE '%ndola%')
  AND latitude IS NULL;

-- Kitwe
UPDATE diesel_suppliers SET latitude = -12.8024, longitude = 28.2132
WHERE (LOWER(name) LIKE '%kitwe%' OR LOWER(location) LIKE '%kitwe%')
  AND latitude IS NULL;

-- ============================================
-- DRC (Congo) - Major Cities
-- ============================================

-- Lubumbashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
WHERE (LOWER(name) LIKE '%lubumbashi%' OR LOWER(location) LIKE '%lubumbashi%')
  AND latitude IS NULL;

-- Kolwezi
UPDATE diesel_suppliers SET latitude = -10.7133, longitude = 25.4667
WHERE (LOWER(name) LIKE '%kolwezi%' OR LOWER(location) LIKE '%kolwezi%')
  AND latitude IS NULL;

-- Likasi
UPDATE diesel_suppliers SET latitude = -10.9833, longitude = 26.7333
WHERE (LOWER(name) LIKE '%likasi%' OR LOWER(location) LIKE '%likasi%')
  AND latitude IS NULL;

-- ============================================
-- MALAWI - Major Cities
-- ============================================

-- Blantyre
UPDATE diesel_suppliers SET latitude = -15.7861, longitude = 35.0058
WHERE (LOWER(name) LIKE '%blantyre%' OR LOWER(location) LIKE '%blantyre%')
  AND latitude IS NULL;

-- Lilongwe
UPDATE diesel_suppliers SET latitude = -13.9626, longitude = 33.7741
WHERE (LOWER(name) LIKE '%lilongwe%' OR LOWER(location) LIKE '%lilongwe%')
  AND latitude IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check suppliers that still need coordinates (will need manual lookup)
-- SELECT id, name, location, address, province, google_maps_url
-- FROM diesel_suppliers
-- WHERE latitude IS NULL OR longitude IS NULL;

-- Count suppliers with/without coordinates
SELECT
  COUNT(*) FILTER
(WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coordinates,
  COUNT
(*) FILTER
(WHERE latitude IS NULL OR longitude IS NULL) as without_coordinates,
  COUNT
(*) as total
FROM diesel_suppliers;
