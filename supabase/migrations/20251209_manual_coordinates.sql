-- Manual Coordinates for Suppliers that couldn't be resolved automatically
-- Run this in Supabase SQL Editor AFTER the main 20251209_resolved_coordinates.sql

-- Fuego Fuels Polokwane (56 Antimoon Street, Polokwane)
UPDATE diesel_suppliers SET latitude = -23.9045, longitude = 29.4689
  WHERE LOWER(name) = LOWER('Fuego Fuels Polokwane') AND latitude IS NULL;

-- Delta Truckstop White River (R538 Airport Road, White River)
UPDATE diesel_suppliers SET latitude = -25.3404, longitude = 31.0121
  WHERE LOWER(name) = LOWER('Delta Truckstop White River') AND latitude IS NULL;

-- Econo Grootvlei (N3 Grootvlei, Mpumalanga)
UPDATE diesel_suppliers SET latitude = -26.7833, longitude = 28.5500
  WHERE LOWER(name) = LOWER('Econo Grootvlei') AND latitude IS NULL;

-- ATS Mosselbaai (Mossdustria, Mossel Bay)
UPDATE diesel_suppliers SET latitude = -34.1583, longitude = 22.0078
  WHERE LOWER(name) = LOWER('ATS Mosselbaai') AND latitude IS NULL;

-- Quantum Pietermaritzburg (Mkondeni)
UPDATE diesel_suppliers SET latitude = -29.6250, longitude = 30.4000
  WHERE LOWER(name) = LOWER('Quantum Pietermaritzburg') AND latitude IS NULL;

-- Industry Petroleum Musina
UPDATE diesel_suppliers SET latitude = -22.3475, longitude = 29.9930
  WHERE LOWER(name) = LOWER('Industry Petroleum Musina') AND latitude IS NULL;

-- Tarlton Truckstop (Krugersdorp area)
UPDATE diesel_suppliers SET latitude = -26.1700, longitude = 27.5300
  WHERE LOWER(name) LIKE '%Tarlton Truckstop%' AND latitude IS NULL;

-- XFuels Mokopane
UPDATE diesel_suppliers SET latitude = -24.1833, longitude = 29.0167
  WHERE LOWER(name) = LOWER('XFuels Mokopane') AND latitude IS NULL;

-- HMI Fuel Germiston (Driehoek)
UPDATE diesel_suppliers SET latitude = -26.2327, longitude = 28.1669
  WHERE LOWER(name) = LOWER('HMI Fuel Germiston') AND latitude IS NULL;

-- Falkfuel Marblehall Truck Stop
UPDATE diesel_suppliers SET latitude = -24.9810, longitude = 29.2840
  WHERE LOWER(name) LIKE '%Falkfuel Marblehall%' AND latitude IS NULL;

-- Karan DRC 8 Kolwezi
UPDATE diesel_suppliers SET latitude = -10.7133, longitude = 25.4667
  WHERE LOWER(name) = LOWER('Karan DRC 8 Kolwezi') AND latitude IS NULL;

-- Karan DRC 10 Lubambashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
  WHERE LOWER(name) = LOWER('Karan DRC 10 Lubambashi') AND latitude IS NULL;

-- Petrostop Tete (Mozambique)
UPDATE diesel_suppliers SET latitude = -16.1564, longitude = 33.5867
  WHERE LOWER(name) = LOWER('Petrostop Tete') AND latitude IS NULL;

-- Karan DRC 2 Lubumbashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
  WHERE LOWER(name) = LOWER('Karan DRC 2 Lubumbashi') AND latitude IS NULL;

-- Karan DRC Likaski (Likasi)
UPDATE diesel_suppliers SET latitude = -10.9833, longitude = 26.7333
  WHERE LOWER(name) = LOWER('Karan DRC Likaski') AND latitude IS NULL;

-- Karan DRC 3 Lubumbashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
  WHERE LOWER(name) = LOWER('Karan DRC 3 Lubumbashi') AND latitude IS NULL;

-- Karan DRC 5 Lubambashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
  WHERE LOWER(name) = LOWER('Karan DRC 5 Lubambashi') AND latitude IS NULL;

-- Karan DRC Kolwezi
UPDATE diesel_suppliers SET latitude = -10.7133, longitude = 25.4667
  WHERE LOWER(name) = LOWER('Karan DRC Kolwezi') AND latitude IS NULL;

-- Karan DRC 7 Lubumbashi
UPDATE diesel_suppliers SET latitude = -11.6611, longitude = 27.4794
  WHERE LOWER(name) = LOWER('Karan DRC 7 Lubumbashi') AND latitude IS NULL;

-- Karan DRC Station Kalubwe Lubumbashi
UPDATE diesel_suppliers SET latitude = -11.6700, longitude = 27.4700
  WHERE LOWER(name) LIKE '%Karan DRC Station Kalubwe%' AND latitude IS NULL;

-- Gauteng Truck Stop and Diesel (Wadeville)
UPDATE diesel_suppliers SET latitude = -26.2625, longitude = 28.1729
  WHERE LOWER(name) LIKE '%Gauteng Truck Stop%' AND latitude IS NULL;

-- Senatla Energies Maanhaarrand
UPDATE diesel_suppliers SET latitude = -26.0667, longitude = 27.3333
  WHERE LOWER(name) LIKE '%Senatla Energies Maanhaarrand%' AND latitude IS NULL;

-- Mafura Energy - Vanderbijlpark
UPDATE diesel_suppliers SET latitude = -26.7000, longitude = 27.8333
  WHERE LOWER(name) LIKE '%Mafura Energy%' AND latitude IS NULL;

-- Karan Zimbabwe Bulawayo
UPDATE diesel_suppliers SET latitude = -20.1500, longitude = 28.5833
  WHERE LOWER(name) = LOWER('Karan Zimbabwe Bulawayo') AND latitude IS NULL;

-- ============================================
-- VERIFICATION: Check remaining without coordinates
-- ============================================
-- SELECT id, name, location, latitude, longitude
-- FROM diesel_suppliers
-- WHERE latitude IS NULL OR longitude IS NULL
-- ORDER BY name;

-- Count verification
SELECT
  COUNT(*) FILTER
(WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as with_coordinates,
  COUNT
(*) FILTER
(WHERE latitude IS NULL OR longitude IS NULL) as without_coordinates,
  COUNT
(*) as total
FROM diesel_suppliers;
