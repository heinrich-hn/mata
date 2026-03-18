-- Populate inspection template items for existing templates
-- This adds checklist items to the templates that currently have 0 items
-- Table structure: template_code, item_code, item_name, category, sort_order, is_active

-- =====================================================
-- TRUCK SERVICE INSPECTION - 10 TON REFRIGERATED
-- =====================================================
INSERT INTO inspection_item_templates
  (template_code, item_code, item_name, category, is_active, sort_order)
VALUES
  -- Engine & Performance
  ('TRUCK_SERVICE_INSP', 'TRK_ENG_001', 'Engine Oil Level', 'Engine & Performance', true, 1),
  ('TRUCK_SERVICE_INSP', 'TRK_ENG_002', 'Coolant Level', 'Engine & Performance', true, 2),
  ('TRUCK_SERVICE_INSP', 'TRK_ENG_003', 'Air Filter Condition', 'Engine & Performance', true, 3),
  ('TRUCK_SERVICE_INSP', 'TRK_ENG_004', 'Battery Condition', 'Engine & Performance', true, 4),
  ('TRUCK_SERVICE_INSP', 'TRK_ENG_005', 'Belts and Hoses', 'Engine & Performance', true, 5),

  -- Braking System
  ('TRUCK_SERVICE_INSP', 'TRK_BRK_001', 'Brake Fluid Level', 'Braking System', true, 6),
  ('TRUCK_SERVICE_INSP', 'TRK_BRK_002', 'Brake Pad Thickness', 'Braking System', true, 7),
  ('TRUCK_SERVICE_INSP', 'TRK_BRK_003', 'Brake Lines', 'Braking System', true, 8),
  ('TRUCK_SERVICE_INSP', 'TRK_BRK_004', 'Parking Brake', 'Braking System', true, 9),

  -- Steering & Suspension
  ('TRUCK_SERVICE_INSP', 'TRK_SUS_001', 'Steering Linkage', 'Steering & Suspension', true, 10),
  ('TRUCK_SERVICE_INSP', 'TRK_SUS_002', 'Shock Absorbers', 'Steering & Suspension', true, 11),
  ('TRUCK_SERVICE_INSP', 'TRK_SUS_003', 'Spring Condition', 'Steering & Suspension', true, 12),

  -- Tires & Wheels
  ('TRUCK_SERVICE_INSP', 'TRK_TYR_001', 'Tire Tread Depth', 'Tires & Wheels', true, 13),
  ('TRUCK_SERVICE_INSP', 'TRK_TYR_002', 'Tire Pressure', 'Tires & Wheels', true, 14),
  ('TRUCK_SERVICE_INSP', 'TRK_TYR_003', 'Wheel Nuts Torque', 'Tires & Wheels', true, 15),
  ('TRUCK_SERVICE_INSP', 'TRK_TYR_004', 'Tire Condition', 'Tires & Wheels', true, 16),

  -- Lighting & Electrical
  ('TRUCK_SERVICE_INSP', 'TRK_LGT_001', 'Headlights', 'Lighting & Electrical', true, 17),
  ('TRUCK_SERVICE_INSP', 'TRK_LGT_002', 'Brake Lights', 'Lighting & Electrical', true, 18),
  ('TRUCK_SERVICE_INSP', 'TRK_LGT_003', 'Turn Indicators', 'Lighting & Electrical', true, 19),
  ('TRUCK_SERVICE_INSP', 'TRK_LGT_004', 'Reverse Lights', 'Lighting & Electrical', true, 20),

  -- Refrigeration Unit
  ('TRUCK_SERVICE_INSP', 'TRK_REF_001', 'Refrigeration Unit Operation', 'Refrigeration', true, 21),
  ('TRUCK_SERVICE_INSP', 'TRK_REF_002', 'Temperature Control', 'Refrigeration', true, 22),
  ('TRUCK_SERVICE_INSP', 'TRK_REF_003', 'Insulation Integrity', 'Refrigeration', true, 23),
  ('TRUCK_SERVICE_INSP', 'TRK_REF_004', 'Refrigerant Level', 'Refrigeration', true, 24),

  -- Body & Cargo Area
  ('TRUCK_SERVICE_INSP', 'TRK_BDY_001', 'Cargo Floor Condition', 'Body & Cargo', true, 25),
  ('TRUCK_SERVICE_INSP', 'TRK_BDY_002', 'Door Operation', 'Body & Cargo', true, 26),
  ('TRUCK_SERVICE_INSP', 'TRK_BDY_003', 'Body Panels', 'Body & Cargo', true, 27);

-- =====================================================
-- HORSE TRUCK SERVICE INSPECTION
-- =====================================================
INSERT INTO inspection_item_templates
  (template_code, item_code, item_name, category, is_active, sort_order)
VALUES
  -- Engine & Performance
  ('HORSE_SERVICE_INSP', 'HRS_ENG_001', 'Engine Oil Level', 'Engine & Performance', true, 1),
  ('HORSE_SERVICE_INSP', 'HRS_ENG_002', 'Coolant Level', 'Engine & Performance', true, 2),
  ('HORSE_SERVICE_INSP', 'HRS_ENG_003', 'Battery Condition', 'Engine & Performance', true, 3),
  ('HORSE_SERVICE_INSP', 'HRS_ENG_004', 'Belts and Hoses', 'Engine & Performance', true, 4),

  -- Braking System
  ('HORSE_SERVICE_INSP', 'HRS_BRK_001', 'Brake Fluid Level', 'Braking System', true, 5),
  ('HORSE_SERVICE_INSP', 'HRS_BRK_002', 'Brake Pad Thickness', 'Braking System', true, 6),
  ('HORSE_SERVICE_INSP', 'HRS_BRK_003', 'Brake Lines', 'Braking System', true, 7),

  -- Tires & Wheels
  ('HORSE_SERVICE_INSP', 'HRS_TYR_001', 'Tire Tread Depth', 'Tires & Wheels', true, 8),
  ('HORSE_SERVICE_INSP', 'HRS_TYR_002', 'Tire Pressure', 'Tires & Wheels', true, 9),
  ('HORSE_SERVICE_INSP', 'HRS_TYR_003', 'Wheel Nuts Torque', 'Tires & Wheels', true, 10),

  -- Lighting
  ('HORSE_SERVICE_INSP', 'HRS_LGT_001', 'Headlights', 'Lighting & Electrical', true, 11),
  ('HORSE_SERVICE_INSP', 'HRS_LGT_002', 'Brake Lights', 'Lighting & Electrical', true, 12),
  ('HORSE_SERVICE_INSP', 'HRS_LGT_003', 'Turn Indicators', 'Lighting & Electrical', true, 13),

  -- Horse Area Specific
  ('HORSE_SERVICE_INSP', 'HRS_HRS_001', 'Partition Condition', 'Horse Area', true, 14),
  ('HORSE_SERVICE_INSP', 'HRS_HRS_002', 'Floor Matting', 'Horse Area', true, 15),
  ('HORSE_SERVICE_INSP', 'HRS_HRS_003', 'Ventilation System', 'Horse Area', true, 16),
  ('HORSE_SERVICE_INSP', 'HRS_HRS_004', 'Ramp Operation', 'Horse Area', true, 17),
  ('HORSE_SERVICE_INSP', 'HRS_HRS_005', 'Tie-Down Points', 'Horse Area', true, 18),
  ('HORSE_SERVICE_INSP', 'HRS_HRS_006', 'Interior Lighting', 'Horse Area', true, 19);

-- =====================================================
-- REEFER UNIT BI-WEEKLY INSPECTION
-- =====================================================
INSERT INTO inspection_item_templates
  (template_code, item_code, item_name, category, is_active, sort_order)
VALUES
  -- Refrigeration System
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_001', 'Compressor Operation', 'Refrigeration System', true, 1),
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_002', 'Condenser Coil Cleaning', 'Refrigeration System', true, 2),
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_003', 'Evaporator Coil Condition', 'Refrigeration System', true, 3),
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_004', 'Refrigerant Pressure', 'Refrigeration System', true, 4),
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_005', 'Temperature Accuracy', 'Refrigeration System', true, 5),
  ('REEFER_BIWEEKLY_INSP', 'REF_REF_006', 'Defrost Cycle', 'Refrigeration System', true, 6),

  -- Electrical Components
  ('REEFER_BIWEEKLY_INSP', 'REF_ELC_001', 'Control Panel Display', 'Electrical', true, 7),
  ('REEFER_BIWEEKLY_INSP', 'REF_ELC_002', 'Wiring Connections', 'Electrical', true, 8),
  ('REEFER_BIWEEKLY_INSP', 'REF_ELC_003', 'Sensor Calibration', 'Electrical', true, 9),
  ('REEFER_BIWEEKLY_INSP', 'REF_ELC_004', 'Alarm System', 'Electrical', true, 10),

  -- Mechanical Components
  ('REEFER_BIWEEKLY_INSP', 'REF_MCH_001', 'Belt Tension', 'Mechanical', true, 11),
  ('REEFER_BIWEEKLY_INSP', 'REF_MCH_002', 'Bearing Condition', 'Mechanical', true, 12),
  ('REEFER_BIWEEKLY_INSP', 'REF_MCH_003', 'Mounting Bolts', 'Mechanical', true, 13),
  ('REEFER_BIWEEKLY_INSP', 'REF_MCH_004', 'Vibration Check', 'Mechanical', true, 14),

  -- Fuel & Fluids
  ('REEFER_BIWEEKLY_INSP', 'REF_FLU_001', 'Diesel Fuel Level', 'Fuel & Fluids', true, 15),
  ('REEFER_BIWEEKLY_INSP', 'REF_FLU_002', 'Engine Oil Level', 'Fuel & Fluids', true, 16),
  ('REEFER_BIWEEKLY_INSP', 'REF_FLU_003', 'Coolant Level', 'Fuel & Fluids', true, 17),

  -- Insulation & Seals
  ('REEFER_BIWEEKLY_INSP', 'REF_INS_001', 'Door Seals', 'Insulation & Seals', true, 18),
  ('REEFER_BIWEEKLY_INSP', 'REF_INS_002', 'Drainage System', 'Insulation & Seals', true, 19),
  ('REEFER_BIWEEKLY_INSP', 'REF_INS_003', 'Insulation Integrity', 'Insulation & Seals', true, 20);
