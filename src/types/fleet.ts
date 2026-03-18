/**
 * Fleet-specific types for dynamic table operations
 * These types provide type safety for dynamic fleet table names
 */

// Known fleet table names from the database schema
export type FleetTableName =
  | 'fleet_10t_tyres'
  | 'fleet_14l_tyres'
  | 'fleet_14t_tyres'
  | 'fleet_17t_tyres'
  | 'fleet_34t_tyres'
  | 'fleet_8t_tyres'
  | 'fleet_h_tyres'
  | 'fleet_r_tyres';

export type FleetPositionTableName =
  | 'fleet_h_positions'
  | 'fleet_r_positions'
  | 'fleet_10t_positions'
  | 'fleet_14l_positions'
  | 'fleet_14t_positions'
  | 'fleet_17t_positions'
  | 'fleet_34t_positions'
  | 'fleet_8t_positions';

// Generic fleet tyre row structure
export interface FleetTyreRow {
  registration_no: string;
  position: string;
  tyre_code: string | null;
  brand?: string | null;
  model?: string | null;
  size?: string | null;
  tread_depth?: number | null;
  condition?: string | null;
  updated_at?: string | null;
}

// Generic fleet position row structure
export interface FleetPositionRow {
  position: string;
  label?: string | null;
  side?: string | null;
  axle?: string | null;
}

/**
 * Type guard to validate fleet table names
 */
export function isValidFleetTableName(tableName: string): tableName is FleetTableName {
  const validTables: FleetTableName[] = [
    'fleet_10t_tyres',
    'fleet_14l_tyres',
    'fleet_14t_tyres',
    'fleet_17t_tyres',
    'fleet_34t_tyres',
    'fleet_8t_tyres',
    'fleet_h_tyres',
    'fleet_r_tyres',
  ];
  return validTables.includes(tableName as FleetTableName);
}

/**
 * Type guard to validate fleet position table names
 */
export function isValidFleetPositionTableName(tableName: string): tableName is FleetPositionTableName {
  const validTables: FleetPositionTableName[] = [
    'fleet_h_positions',
    'fleet_r_positions',
    'fleet_10t_positions',
    'fleet_14l_positions',
    'fleet_14t_positions',
    'fleet_17t_positions',
    'fleet_34t_positions',
    'fleet_8t_positions',
  ];
  return validTables.includes(tableName as FleetPositionTableName);
}