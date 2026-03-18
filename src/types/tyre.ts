// Phase 2: TypeScript Interfaces & Types for Tire Management System

// Health status enums
export type TyreHealthStatus = 'excellent' | 'good' | 'warning' | 'critical';
export type PressureHealthStatus = 'normal' | 'low' | 'high' | 'critical';
export type MetricType = 'metric' | 'imperial';
export type ConstructionType = 'R' | 'D' | 'B';
export type AxleType = 'steer' | 'drive' | 'trailer';

// Tyre Configuration Interface
export interface TyreConfig {
  id: string;
  config_name: string;
  brand: string;
  model: string;

  // Size specifications
  width: number;
  aspect_ratio: number;
  rim_diameter: number;
  metric_type: MetricType;
  construction: ConstructionType;

  // Performance specs
  load_index?: number;
  speed_rating?: string;

  // Tread specifications
  factory_tread_depth: number;
  minimum_tread_depth: number;
  life_expectancy?: number;

  // Pressure specs
  recommended_pressure?: number;
  max_pressure?: number;

  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Enhanced Tyre Record Interface
export interface TyreRecord {
  id: string;
  tin?: string;
  serial_number?: string;

  // References
  tyre_config_id?: string;
  tyre_config?: TyreConfig;
  part_id?: string;
  inventory_id?: string;
  axle_config_id?: string;

  // Basic info
  brand: string;
  model: string;
  size: string;
  type: string;

  // Installation tracking
  installed_at?: string;
  current_meter?: number;

  // Condition tracking
  current_tread_depth?: number;
  initial_tread_depth?: number;
  tread_depth_health: TyreHealthStatus;
  pressure_health: PressureHealthStatus;
  condition: string;
  km_travelled?: number;

  // Dates
  purchase_date?: string;
  purchase_price?: number;
  last_inspection_date?: string;
  rotation_due_date?: string;
  replacement_due_km?: number;

  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Axle Configuration Interface
export interface AxleConfiguration {
  id: string;
  vehicle_id: string;
  axle_number: number;
  axle_type: AxleType;
  position_count: number;
  description?: string;
  created_at?: string;
}

// Detailed Position Tracking
export interface TyrePositionDetailed {
  id: string;
  vehicle_id: string;
  axle_config_id?: string;
  position_code: string;
  position_label: string;
  current_tyre_id?: string;
  is_active: boolean;
  created_at?: string;
}

// Filter Criteria Interface
export interface FilterCriteria {
  include?: {
    field: string;
    values: unknown[];
  }[];
  exclude?: {
    field: string;
    values: unknown[];
  }[];
  healthStatus?: TyreHealthStatus[];
  pressureStatus?: PressureHealthStatus[];
  dateRange?: {
    field: string;
    from: Date;
    to: Date;
  };
  searchTerm?: string;
}

// Sort Criteria Interface
export type SortCriteria = {
  field: string;
  direction: 'asc' | 'desc';
}[];

// Installation Process Interface
export interface TyreInstallation {
  tyre_id: string;
  vehicle_id: string;
  axle_config_id?: string;
  position_code: string;
  installed_at: Date;
  current_meter: number;
  installer_name: string;
  notes?: string;
}

// Three-point Tread Measurement Interface
export interface TreadMeasurement {
  inner: number;
  center: number;
  outer: number;
  average: number;
  variance: number;
}

// Inventory Stock Interface (extended)
export interface TyreInventoryStock {
  id: string;
  brand: string;
  model: string;
  size: string;
  type: string;
  dot_code?: string;
  quantity: number;
  min_quantity: number;
  unit_price?: number;
  purchase_cost_zar?: number;
  purchase_cost_usd?: number;
  pressure_rating?: number;
  initial_tread_depth?: number;
  supplier?: string;
  vendor?: string;
  location?: string;
  status: string;

  // New fields
  tyre_config_id?: string;
  tyre_config?: TyreConfig;
  part_id?: string;
  qr_code?: string;
  barcode?: string;
  warranty_months?: number;
  warranty_km?: number;

  created_at?: string;
  updated_at?: string;
}

// Health Statistics Interface
export interface TyreHealthStats {
  excellent: number;
  good: number;
  warning: number;
  critical: number;
  total: number;
}

// Alert Interface
export interface TyreAlert {
  id: string;
  tyre_id: string;
  tyre_tin?: string;
  alert_type: 'critical_tread' | 'low_pressure' | 'high_pressure' | 'rotation_due' | 'replacement_due';
  severity: 'high' | 'medium' | 'low';
  message: string;
  created_at: string;
}