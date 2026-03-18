-- Migration: Insert drivers from driver list
-- Date: 2026-01-15
-- Description: Bulk insert of drivers with their details

INSERT INTO drivers
  (
  driver_number,
  first_name,
  last_name,
  license_number,
  phone,
  status,
  notes,
  created_at,
  updated_at
  )
VALUES
  -- Driver PIN 283
  ('283', 'Peter', 'Farai', 'EN772421', '0817478527', 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 75-268211X-75', NOW(), NOW()),

  -- Driver PIN 285
  ('285', 'Phillimon', 'Kwarire', 'AE020649', '0613668359', 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 44047755T44', NOW(), NOW()),

  -- Driver PIN 280
  ('280', 'Jonathan', 'Bepete', 'EN905695', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 75-167347Y-75', NOW(), NOW()),

  -- Driver PIN 5
  ('5', 'Vengayi', 'Makozhombwe', 'EN109903', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 71-076347Y-71', NOW(), NOW()),

  -- Driver PIN 281
  ('281', 'Canaan', 'Chipfurutse', 'AE779063', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 631159761507', NOW(), NOW()),

  -- Driver PIN 294
  ('294', 'Enock', 'Mukonyerwa', 'GN483945', '0814956633', 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 44-066516L-44', NOW(), NOW()),

  -- Driver PIN 9
  ('9', 'Lovemore', 'Qochiwe', 'DN396706', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000 | Passport: 13-1427982-13', NOW(), NOW()),

  -- Driver PIN 528
  ('528', 'Decide', 'Murahwa', '75-374887', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000', NOW(), NOW()),

  -- Driver PIN 11
  ('11', 'Doctor', 'Kondwani', '43-051679C43', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000', NOW(), NOW()),

  -- Driver PIN 12
  ('12', 'Wellington', 'Musumbu', '29-240694M75', NULL, 'active',
    'Controller: Heinrich Nel | Auth Amount: 1000000', NOW(), NOW()),

  -- Driver PIN Tanyanyiwa
  ('Tanyanyiwa', 'Luckson', 'Tanyanyiwa', 'PENDING-Tanyanyiwa', NULL, 'active',
    'Controller: Emmanuel Tapson Chikovi | Auth Amount: 50000', NOW(), NOW()),

  -- Driver PIN 01
  ('01', 'Biggie', 'Mugwa', '86-019045-L86', '+263779615408', 'active',
    'Controller: Alec Maocha | Auth Amount: 50', NOW(), NOW()),

  -- Driver PIN Mutengerere
  ('Mutengerere', 'Jekai', 'Mutengerere', 'PENDING-Mutengerere', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Padziya
  ('Padziya', 'Collen', 'Padziya', 'PENDING-Padziya', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Mubaiwa
  ('Mubaiwa', 'Jairos', 'Mubaiwa', 'PENDING-Mubaiwa', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Tembo
  ('Tembo', 'Shepherd', 'Tembo', 'PENDING-Tembo', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Jakopo
  ('Jakopo', 'Manezhu', 'Jakopo', 'PENDING-Jakopo', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Chitengo
  ('Chitengo', 'Steven', 'Chitengo', 'PENDING-Chitengo', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Zuze
  ('Zuze', 'Shart', 'Zuze', 'PENDING-Zuze', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN Paul
  ('Paul', 'Paul', 'Mwanyadza', 'PENDING-Paul', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN 55555
  ('55555', 'Alec', 'Maocha', 'PENDING-55555', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN A158
  ('A158', 'Taurayi', 'Vherenaisi', 'S8140154T58', NULL, 'active',
    NULL, NOW(), NOW()),

  -- Driver PIN AM
  ('AM', 'Adrian', 'Moyo', '53/070281M53', '+263775322507', 'active',
    'Passport: AE024872', NOW(), NOW()),

  -- Driver PIN 1738
  ('1738', 'Farai', 'Mlambo', 'PENDING-1738', NULL, 'active',
    NULL, NOW(), NOW())

ON CONFLICT
(driver_number) DO
UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  license_number = COALESCE(EXCLUDED.license_number, drivers.license_number),
  phone = COALESCE(EXCLUDED.phone, drivers.phone),
  notes = COALESCE(EXCLUDED.notes, drivers.notes),
  updated_at = NOW();
