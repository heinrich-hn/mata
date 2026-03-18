export type MaintenanceScheduleType = 'one_time' | 'recurring';
export type MaintenanceFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceCategory = 'inspection' | 'service' | 'repair' | 'replacement' | 'calibration';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'skipped';
export type MaintenanceAlertType = 'upcoming' | 'overdue' | 'completed' | 'cancelled';

// Flexible interface that works with actual DB schema and extended data
export interface MaintenanceSchedule {
  // Required fields from actual DB schema
  id: string;
  vehicle_id: string;
  service_type?: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Optional fields for backward compatibility
  title?: string;
  description?: string | null;
  schedule_type?: MaintenanceScheduleType;
  frequency?: MaintenanceFrequency | null;
  frequency_value?: number;
  start_date?: string;
  end_date?: string | null;
  last_completed_date?: string | null;
  estimated_duration_hours?: number | null;
  priority?: MaintenancePriority;
  assigned_to?: string | null;
  assigned_team?: string | null;
  category?: MaintenanceCategory;
  maintenance_type?: string;
  alert_before_hours?: number[];
  notification_channels?: unknown;
  notification_recipients?: unknown;
  auto_create_job_card?: boolean;
  related_template_id?: string | null;
  odometer_based?: boolean;
  odometer_interval_km?: number | null;
  last_odometer_reading?: number | null;
  // NOTE: For REEFER fleets (suffix F), odometer_based/odometer_interval_km/last_odometer_reading
  // are repurposed for hours-based tracking. The UI displays "hours" labels but stores in odometer columns.
  notes?: string | null;
  created_by?: string;
}

// Updated to match actual database schema  
export interface MaintenanceScheduleHistory {
  id: string;
  schedule_id: string;
  completed_date: string;
  status: string;
  duration_hours: number;
  total_cost: number;
  notes: string;
  created_at: string;
}

export interface MaintenanceAlert {
  id: string;
  schedule_id: string;
  alert_type: MaintenanceAlertType;
  alert_time: string;
  due_date: string;
  hours_until_due: number | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  notification_method: 'email' | 'sms' | 'in_app' | 'all';
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_name: string | null;
  delivery_status: 'pending' | 'sent' | 'delivered' | 'failed' | 'acknowledged';
  error_message: string | null;
  created_at: string;
}