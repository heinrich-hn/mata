/**
 * Load Planning Types
 * Types for distribution schedule planning and bulk import
 */

export interface DistributionScheduleEntry {
  dispatchDate: string; // YYYY-MM-DD
  arrivalDate: string; // YYYY-MM-DD
  farm: 'CBC' | 'BV' | string;
  destination: string; // Harare, Bulawayo, Mutare, etc.
  channel: 'retail' | 'vendor' | 'vansales' | 'direct' | 'municipal' | string;
  packaging: 'crates' | 'bins' | 'boxes' | 'pallets' | string;
  palletCount?: number;
  notes?: string;
  contactPerson?: string;
  contactPhone?: string;
  weightKg?: number;
  volumeM3?: number;
  quotedPrice?: number;
  customerName?: string; // Override default destination as customer
}

export interface RecurringSchedule {
  id: string;
  name: string;
  origin: string;
  destination: string;
  channel: string;
  packagingType: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  daysOfWeek?: number[]; // [1, 3, 5] for Mon/Wed/Fri (1=Monday, 7=Sunday)
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  lastGenerated?: string;
}

export interface LoadTemplate {
  id: string;
  name: string;
  description?: string;
  origin: string;
  originLat?: number;
  originLng?: number;
  destination: string;
  destinationLat?: number;
  destinationLng?: number;
  cargoType: string;
  packagingType: string;
  channel: string;
  estimatedDurationHours: number;
  estimatedDistanceKm: number;
  specialRequirements?: string[];
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  usageCount: number;
  createdAt: string;
}

export interface BulkImportMapping {
  dispatchDateColumn: string;
  arrivalDateColumn: string;
  farmColumn: string;
  destinationColumn: string;
  channelColumn: string;
  packagingColumn: string;
  palletsColumn?: string;
  notesColumn?: string;
  contactPersonColumn?: string;
  contactPhoneColumn?: string;
  weightKgColumn?: string;
  volumeM3Column?: string;
  quotedPriceColumn?: string;
  customerNameColumn?: string;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    error: string;
  }>;
  createdLoads: string[]; // Array of load IDs
}

export interface WeeklyPlanningView {
  weekStart: string; // ISO date
  weekEnd: string;
  loadsByDay: Record<string, DistributionScheduleEntry[]>;
  vehicleCapacity: {
    available: number;
    assigned: number;
    utilization: number;
  };
}

export interface RouteSuggestion {
  farm: string;
  destination: string;
  frequency: number; // Times per week/month
  avgVolume: number;
  lastUsed: string;
  suggestedTemplate: boolean;
}

// Farm location database
export const FARM_LOCATIONS = {
  CBC: {
    name: 'CBC Farm',
    address: 'CBC Farm, Zimbabwe',
    lat: -17.8252,
    lng: 31.0335,
  },
  BV: {
    name: 'BURMA VALLEY',
    address: 'BURMA VALLEY, Zimbabwe',
    lat: -17.7500,
    lng: 31.1000,
  },
} as const;

// Destination location database
export const DESTINATION_LOCATIONS = {
  Harare: {
    name: 'Harare Central',
    address: 'Harare, Zimbabwe',
    lat: -17.8292,
    lng: 31.0522,
  },
  Bulawayo: {
    name: 'Bulawayo',
    address: 'Bulawayo, Zimbabwe',
    lat: -20.1496,
    lng: 28.5833,
  },
  Mutare: {
    name: 'Mutare',
    address: 'Mutare, Zimbabwe',
    lat: -18.9707,
    lng: 32.6704,
  },
  'Freshmark Polokwane': {
    name: 'Freshmark Polokwane',
    address: 'Polokwane, South Africa',
    lat: -23.9045,
    lng: 29.4689,
  },
  'Fresh Approach': {
    name: 'Fresh Approach',
    address: 'South Africa',
    lat: -25.7461,
    lng: 28.1881,
  },
  'Freshmark Centurion': {
    name: 'Freshmark Centurion',
    address: 'Centurion, South Africa',
    lat: -25.8601,
    lng: 28.1878,
  },
  "Farmer's Trust": {
    name: "Farmer's Trust",
    address: 'South Africa',
    lat: -26.2041,
    lng: 28.0473,
  },
} as const;

// Channel types
export const CHANNEL_TYPES = [
  'retail',
  'vendor',
  'vansales',
  'direct',
  'municipal',
] as const;

// Packaging types
export const PACKAGING_TYPES = [
  'crates',
  'bins',
  'boxes',
  'pallets',
] as const;