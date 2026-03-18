/**
 * Recurring Schedule Types
 * For automated load generation based on recurring patterns
 */

export interface RecurringSchedule {
  id: string;
  name: string;
  description?: string;
  origin: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  channel?: 'retail' | 'vendor' | 'vansales' | 'direct' | 'municipal';
  packaging_type?: string;
  pallet_count?: number;
  cargo_type?: string;
  special_requirements?: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  days_of_week?: number[]; // 1=Monday, 7=Sunday
  time_of_day?: string; // HH:MM:SS
  delivery_offset_days?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  currency?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  last_generated_date?: string;
  total_loads_generated?: number;
}

export interface CreateRecurringScheduleInput {
  name: string;
  description?: string;
  origin: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  channel?: RecurringSchedule['channel'];
  packaging_type?: string;
  pallet_count?: number;
  cargo_type?: string;
  special_requirements?: string[];
  frequency: RecurringSchedule['frequency'];
  days_of_week?: number[];
  time_of_day?: string;
  delivery_offset_days?: number;
  priority?: RecurringSchedule['priority'];
  currency?: string;
}

export interface GenerateLoadsResult {
  generated_count: number;
  load_ids: string[];
}

export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;

export const FREQUENCY_LABELS: Record<RecurringSchedule['frequency'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

// Common recurring schedule templates
export const SCHEDULE_TEMPLATES: Partial<CreateRecurringScheduleInput>[] = [
  {
    name: 'Harare Retail Daily',
    origin: 'BURMA VALLEY',
    destination: 'Harare',
    channel: 'retail',
    packaging_type: 'crates',
    frequency: 'daily',
    time_of_day: '06:00:00',
    delivery_offset_days: 1,
    priority: 'high',
  },
  {
    name: 'Bulawayo Vendor (Mon/Wed/Fri)',
    origin: 'CBC Farm',
    destination: 'Bulawayo',
    channel: 'vendor',
    packaging_type: 'bins',
    pallet_count: 20,
    frequency: 'weekly',
    days_of_week: [1, 3, 5], // Mon, Wed, Fri
    time_of_day: '06:00:00',
    delivery_offset_days: 1,
    priority: 'medium',
  },
  {
    name: 'Mutare Route (Mon/Wed/Fri)',
    origin: 'BURMA VALLEY',
    destination: 'Mutare',
    channel: 'retail',
    packaging_type: 'crates',
    frequency: 'weekly',
    days_of_week: [1, 3, 5],
    time_of_day: '06:00:00',
    delivery_offset_days: 0, // Same day delivery
    priority: 'medium',
  },
  {
    name: 'SA Export Weekly',
    origin: 'CBC Farm',
    destination: 'Freshmark Polokwane',
    channel: 'direct',
    packaging_type: 'crates',
    frequency: 'weekly',
    days_of_week: [1], // Every Monday
    time_of_day: '04:00:00',
    delivery_offset_days: 2, // 2-day transit
    priority: 'high',
  },
];