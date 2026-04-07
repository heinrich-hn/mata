
import type { Database, Json } from '@/integrations/supabase/types';
import type {
  ActionItem,
  CARReport,
  CostEntry,
  DieselConsumptionRecord,
  DieselNorms,
  DriverBehaviorEvent,
  MissedLoad,
  Trip
} from '@/types/operations';

// Database types - adjust table names to match your actual schema
type DbTrip = Database['public']['Tables']['trips']['Row'];
type DbTripInsert = Database['public']['Tables']['trips']['Insert'];
type DbCostEntry = Database['public']['Tables']['cost_entries']['Row'];
type DbCostInsert = Database['public']['Tables']['cost_entries']['Insert'];
type DbDieselRecord = Database['public']['Tables']['diesel_records']['Row'];
type DbDieselInsert = Database['public']['Tables']['diesel_records']['Insert'];
type DbDriverEvent = Database['public']['Tables']['driver_behavior_events']['Row'];
type DbDriverInsert = Database['public']['Tables']['driver_behavior_events']['Insert'];
type DbActionItem = Database['public']['Tables']['action_items']['Row'];
type DbActionInsert = Database['public']['Tables']['action_items']['Insert'];
type DbCARReport = Database['public']['Tables']['car_reports']['Row'];
type DbCARInsert = Database['public']['Tables']['car_reports']['Insert'];
type DbMissedLoad = Database['public']['Tables']['missed_loads']['Row'];

// Helper to safely parse JSON arrays from database
const parseJsonArray = <T>(json: Json | null): T[] => {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  return [];
};

// Helper to safely convert arrays to Json
const toJsonArray = <T>(arr: T[] | undefined): Json | undefined => {
  if (!arr) return undefined;
  return arr as unknown as Json;
};

// Trip mappers
export const mapDbToTrip = (db: DbTrip): Trip => ({
  ...db,
  client_type: (db.client_type as Trip['client_type']) || 'external',
  status: (db.status as Trip['status']) || 'active',
  payment_status: (db.payment_status as Trip['payment_status']) || 'unpaid',
  revenue_currency: (db.revenue_currency as Trip['revenue_currency']) || 'ZAR',
  revenue_type: (db.revenue_type as Trip['revenue_type']) || 'per_load',
  invoice_currency: (db.invoice_currency as Trip['invoice_currency']) || 'ZAR',
  follow_up_method: db.follow_up_method as Trip['follow_up_method'],
  additional_costs: parseJsonArray(db.additional_costs),
  delay_reasons: parseJsonArray(db.delay_reasons),
  follow_up_history: parseJsonArray(db.follow_up_history),
  edit_history: parseJsonArray(db.edit_history)
});

export const mapTripToDb = (trip: Partial<Trip>): Partial<DbTripInsert> => {
  const dbTrip = { ...trip } as unknown as Partial<DbTripInsert>;
  if (trip.additional_costs) dbTrip.additional_costs = toJsonArray(trip.additional_costs);
  if (trip.delay_reasons) dbTrip.delay_reasons = toJsonArray(trip.delay_reasons);
  if (trip.follow_up_history) dbTrip.follow_up_history = toJsonArray(trip.follow_up_history);
  return dbTrip;
};

// Cost Entry mappers
export const mapDbToCostEntry = (db: DbCostEntry): CostEntry => ({
  ...db,
  investigation_status: (db.investigation_status as CostEntry['investigation_status']) || 'pending',
  attachments: parseJsonArray(db.attachments)
});

export const mapCostEntryToDb = (cost: CostEntry): Partial<DbCostInsert> => ({
  ...cost,
  attachments: toJsonArray(cost.attachments)
} as Partial<DbCostInsert>);

// Diesel Record mappers
export const mapDbToDieselRecord = (db: DbDieselRecord): DieselConsumptionRecord => ({
  ...db,
  trailer_fuel_data: parseJsonArray(db.trailer_fuel_data)
} as DieselConsumptionRecord);

export const mapDieselRecordToDb = (record: DieselConsumptionRecord): Partial<DbDieselInsert> => ({
  ...record,
  trailer_fuel_data: toJsonArray(record.trailer_fuel_data)
} as Partial<DbDieselInsert>);

// Diesel Norms mappers
export const mapDbToDieselNorms = (db: DieselNorms): DieselNorms => db;

// Driver Event mappers
export const mapDbToDriverEvent = (db: DbDriverEvent): DriverBehaviorEvent => ({
  ...db,
  severity: (db.severity as DriverBehaviorEvent['severity']) || 'medium',
  status: (db.status as DriverBehaviorEvent['status']) || 'open',
  attachments: parseJsonArray(db.attachments)
});

export const mapDriverEventToDb = (event: DriverBehaviorEvent): Partial<DbDriverInsert> => ({
  ...event,
  attachments: toJsonArray(event.attachments)
} as Partial<DbDriverInsert>);

// Action Item mappers
export const mapDbToActionItem = (db: DbActionItem): ActionItem => ({
  ...db,
  priority: (db.priority as ActionItem['priority']) || 'medium',
  status: (db.status as ActionItem['status']) || 'open',
  comments: parseJsonArray(db.comments),
  progress_lines: parseJsonArray(db.progress_lines)
});

export const mapActionItemToDb = (item: ActionItem): Partial<DbActionInsert> => ({
  ...item,
  comments: toJsonArray(item.comments),
  progress_lines: toJsonArray(item.progress_lines)
} as Partial<DbActionInsert>);

// CAR Report mappers
export const mapDbToCARReport = (db: DbCARReport): CARReport => ({
  ...db,
  severity: (db.severity as CARReport['severity']) || 'medium',
  status: (db.status as CARReport['status']) || 'open',
  attachments: parseJsonArray(db.attachments)
});

export const mapCARReportToDb = (report: CARReport): Partial<DbCARInsert> => ({
  ...report,
  attachments: toJsonArray(report.attachments)
} as Partial<DbCARInsert>);

// Missed Load mappers
export const mapDbToMissedLoad = (db: DbMissedLoad): MissedLoad => db as MissedLoad;