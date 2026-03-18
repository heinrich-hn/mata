// Cost-related types
export interface Cost {
  id: string;
  trip_id?: string;
  category: string;
  sub_category?: string;
  amount: number;
  currency: string;
  reference_number?: string;
  date: string;
  notes?: string;
  is_flagged: boolean;
  flag_reason?: string;
  is_system_generated?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Vehicle Fault types
export interface VehicleFault {
  id: string;
  vehicle_id: string;
  fault_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'identified' | 'acknowledged' | 'resolved';
  fault_number?: string;
  fault_category?: string;
  fault_description?: string;
  component?: string;
  reported_by?: string;
  reported_date: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_date?: string;
  resolution_notes?: string;
  inspection_fault_id?: string;
  vehicles?: {
    registration_number?: string;
    make?: string;
    model?: string;
  };
  created_at: string;
  updated_at: string;
}

// Trip Edit History Record
export interface EditHistoryRecord {
  editedBy: string;
  editedAt: string;
  reason: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

// Tyre types for analytics
export interface TyreData {
  id: string;
  tin: string;
  brand: string;
  current_fleet_position?: string;
  current_tread_depth?: number;
  tread_depth_health?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  km_travelled?: number;
  status?: string;
  condition?: string;
  created_at: string;
  updated_at: string;
}

// Vehicle data for fleet filtering
export interface VehicleFleetData {
  id: string;
  fleet_number?: string;
  registration_number?: string;
}