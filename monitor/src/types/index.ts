// ─── Alert Types ─────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "active" | "resolved" | "suppressed"; // Removed "acknowledged"
export type AlertCategory =
  | "speed_violation"
  | "geofence_breach"
  | "fuel_anomaly"
  | "maintenance_due"
  | "driver_behavior"
  | "vehicle_fault"
  | "trip_delay"
  | "load_exception"
  | "tyre_pressure"
  | "duplicate_pod"
  | "document_expiry"
  | "custom";

export type AlertSourceType =
  | "vehicle"
  | "driver"
  | "trip"
  | "load"
  | "geofence"
  | "system"
  | "maintenance"
  | "fuel"
  | "tyre"
  | "manual";

export interface Alert {
  id: string;
  config_id: string | null;
  source_type: AlertSourceType;
  source_id: string | null;
  source_label: string | null;
  title: string;
  message: string;
  category: AlertCategory;
  severity: AlertSeverity;
  metadata: Record<string, unknown>;
  status: AlertStatus; // Now only "active" | "resolved" | "suppressed"
  // Keep these fields for schema compatibility but mark as optional/never used
  acknowledged_by?: string | null;  // Made optional
  acknowledged_at?: string | null;  // Made optional
  resolved_at: string | null;
  resolution_note: string | null;
  triggered_at: string;
  expires_at: string | null;
  created_at: string;
}

// Update AlertComment (no changes needed)
export interface AlertComment {
  id: string;
  alert_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

// ─── Alert Configuration Types ────────────────────────────────────────────────

export interface AlertConfiguration {
  id: string;
  created_by: string;
  name: string;
  description: string | null;
  category: AlertCategory;
  severity: AlertSeverity;
  conditions: Record<string, unknown>;
  is_active: boolean;
  notify_email: boolean;
  notify_push: boolean;
  notify_in_app: boolean;
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface KPISnapshot {
  id: string;
  snapshot_date: string;
  period: "hourly" | "daily" | "weekly" | "monthly";
  kpi_name: string;
  value: number;
  unit: string | null;
  dimensions: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  source_type: string;
  source_id: string | null;
  metrics: Record<string, unknown>;
  dimensions: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface AlertFilters {
  timeRange: "last1h" | "last6h" | "last24h" | "last7d" | "last30d" | "custom";
  startDate: Date;
  endDate: Date;
  severities: AlertSeverity[];
  categories: AlertCategory[];
  sourceTypes: AlertSourceType[];
  statuses: AlertStatus[]; // Now only includes "active" | "resolved" | "suppressed"
  searchQuery: string;
  selectedVehicle: string | null;
  selectedFleets: string[];
}

export const DEFAULT_FILTERS: AlertFilters = {
  timeRange: "last24h",
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(),
  severities: [],
  categories: [],
  sourceTypes: [],
  statuses: ["active"], // Only active by default
  searchQuery: "",
  selectedVehicle: null,
  selectedFleets: [],
};

// ─── User / Auth Types ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  monitor_access: "none" | "read_only" | "operator" | "admin";
}

// ─── KPI Display Types ────────────────────────────────────────────────────────

export interface KPICard {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  icon: string;
  color: string;
}

// ─── Chart Data Types ─────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  period: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
  color: string;
}