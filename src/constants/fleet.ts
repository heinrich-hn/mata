// Fleet-related constants

// All fleet numbers in the system (aligned with fleetTyreConfig.ts)
export const FLEET_NUMBERS = [
  // Horse fleets (H-series)
  '1H', '4H', '6H', '21H', '22H', '23H', '24H', '26H', '28H',
  '29H', '30H', '31H', '32H', '33H', '34H',
  // Trailer fleets (T-series)
  '1T', '2T', '3T', '4T',
  // Reefer fleets (F-series)
  '4F', '5F', '6F', '7F', '8F', '9F',
  // Low-bed fleets (L-series)
  '14L', '15L', '16L',
  // Special fleets
  'UD'
] as const;

// Trucks equipped with calibrated fuel level sensors (probes)
export const TRUCKS_WITH_PROBES = [
  '4H', '6H', '23H', '24H', '26H', '28H', '29H', '31H'
] as const;

export const REEFER_UNITS = [
  '4F', '5F', '6F', '7F', '8F', '9F'
] as const;

export type FleetNumber = typeof FLEET_NUMBERS[number];
export type TruckWithProbe = typeof TRUCKS_WITH_PROBES[number];
export type ReeferUnit = typeof REEFER_UNITS[number];

// Wialon sensor configuration mapping
// Maps fleet numbers to their Wialon unit IDs and fuel sensor IDs
export const FLEET_SENSOR_MAPPING = {
  '23H': {
    unit_id: 352592576285704,
    unit_name: '23H - AFQ 1324 (Int Sim)',
    hardware: 'Teltonika FMB920',
    small_tank_sensor_id: 2,
    big_tank_sensor_id: 3,
    ignition_sensor_id: 1,
    small_tank_param: 'io_273',
    big_tank_param: 'io_270',
    fuel_rate_coefficient: 51,
  },
  '24H': {
    unit_id: 352625693727222,
    unit_name: '24H - AFQ 1325 (Int Sim)',
    hardware: 'Teltonika FMB920',
    small_tank_sensor_id: 3,
    big_tank_sensor_id: 4,
    ignition_sensor_id: 1,
    small_tank_param: 'io_273',
    big_tank_param: 'io_270',
    fuel_rate_coefficient: 51,
  },
  '26H': {
    unit_id: 357544376232183,
    unit_name: '26H - AFQ 1327 (Int Sim)',
    hardware: 'Teltonika FMB140',
    small_tank_sensor_id: 1,
    big_tank_sensor_id: 2,
    ignition_sensor_id: 3,
    small_tank_param: 'io_273',
    big_tank_param: 'io_270',
    fuel_rate_coefficient: 51,
  },
  '28H': {
    unit_id: 352592576816946,
    unit_name: '28H - AFQ 1329 (Int Sim)',
    hardware: 'Teltonika FMB920',
    small_tank_sensor_id: 1,
    big_tank_sensor_id: 2,
    ignition_sensor_id: 3,
    small_tank_param: 'io_273',
    big_tank_param: 'io_270',
    fuel_rate_coefficient: 51,
  },
  '31H': {
    unit_id: 864454077925646,
    unit_name: '31H - AGZ 1963 (Int sim)',
    hardware: 'Teltonika FMC920',
    small_tank_sensor_id: 1,
    big_tank_sensor_id: 2,
    ignition_sensor_id: 3,
    small_tank_param: 'io_273',
    big_tank_param: 'io_270',
    fuel_rate_coefficient: 48,
  },
} as const;

export type FleetSensorConfig = typeof FLEET_SENSOR_MAPPING[keyof typeof FLEET_SENSOR_MAPPING];