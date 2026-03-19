// Operations type definitions for fleet management

import { EditHistoryRecord } from './forms';

export interface Trip {
  id: string;
  trip_number: string;
  driver_name?: string;
  vehicle_id?: string;
  fleet_vehicle_id?: string;
  client_name?: string;
  client_type?: 'internal' | 'external';
  load_type?: string;
  origin?: string;
  destination?: string;
  route?: string;
  description?: string;
  starting_km?: number;
  ending_km?: number;
  distance_km?: number;
  empty_km?: number;
  empty_km_reason?: string;
  zero_revenue_comment?: string;
  departure_date?: string;
  arrival_date?: string;
  base_revenue?: number;
  revenue_currency?: 'ZAR' | 'USD';
  revenue_type?: 'per_load' | 'per_km';
  rate_per_km?: number;
  status: 'active' | 'completed' | 'cancelled' | 'paid';
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_amount?: number;
  payment_received_date?: string;
  payment_method?: string;
  payment_notes?: string;
  bank_reference?: string;
  invoice_submitted_date?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_due_date?: string;
  invoice_amount?: number;
  invoice_currency?: 'ZAR' | 'USD';
  invoice_terms_days?: number;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_method?: 'email' | 'phone' | 'sms' | 'whatsapp';
  last_follow_up_date?: string;
  completed_at?: string;
  completed_by?: string;
  auto_completed_at?: string;
  auto_completed_reason?: string;
  verified_no_costs?: boolean;
  verified_no_costs_by?: string;
  verified_no_costs_at?: string;
  edit_history?: EditHistoryRecord[];
  additional_costs?: AdditionalCost[];
  delay_reasons?: DelayReason[];
  follow_up_history?: FollowUpRecord[];
  costs?: CostEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface CostEntry {
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
  is_system_generated: boolean;
  flag_reason?: string;
  investigation_notes?: string;
  investigation_status?: 'pending' | 'in_progress' | 'resolved' | 'closed';
  resolved_at?: string;
  resolved_by?: string;
  attachments?: Attachment[];
  diesel_record_id?: string;
  vehicle_identifier?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  uploaded_at: string;
  trip_id?: string;
  cost_entry_id?: string;
  file_data?: string;
}

export interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  notes?: string;
  supporting_documents?: Attachment[];
}

export interface DelayReason {
  id: string;
  reason: string;
  delay_hours: number;
  responsible_party?: string;
  financial_impact?: number;
  recorded_at: string;
  notes?: string;
}

export interface FollowUpRecord {
  id: string;
  trip_id: string;
  follow_up_date: string;
  contact_method: 'call' | 'email' | 'whatsapp' | 'meeting';
  responsible_staff: string;
  response_summary: string;
  status: 'completed' | 'no_response' | 'follow_up_required';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  outcome?: 'payment_received' | 'partial_payment' | 'promise_to_pay' | 'dispute' | 'other';
}

export interface TrailerFuelData {
  trailer_id: string;
  operating_hours: number;
  litres_per_hour: number;
  total_litres: number;
  fuel_cost: number;
}

export interface DieselConsumptionRecord {
  id: string;
  trip_id?: string;
  fleet_number: string;
  driver_name?: string;
  fuel_station: string;
  litres_filled: number;
  total_cost: number;
  cost_per_litre?: number;
  km_reading: number;
  previous_km_reading?: number;
  distance_travelled?: number;
  km_per_litre?: number;
  date: string;
  currency?: string;
  notes?: string;

  // Debrief fields
  debrief_date?: string;
  debrief_notes?: string;
  debrief_signed?: boolean;
  debrief_signed_by?: string;
  debrief_signed_at?: string;

  // Probe verification
  probe_reading?: number;
  probe_discrepancy?: number;
  probe_verified?: boolean;
  probe_verified_by?: string;
  probe_verified_at?: string;
  probe_action_taken?: string;

  // Trailer tracking fields
  linked_trailers?: string[];
  trailer_fuel_data?: TrailerFuelData[];
  vehicle_litres_only?: number;
  trailer_litres_total?: number;
  vehicle_fuel_cost?: number;
  trailer_fuel_cost?: number;

  // Debrief trigger fields
  requires_debrief?: boolean;
  debrief_trigger_reason?: string;
  cost_entry_ids?: string[];

  created_at?: string;
  updated_at?: string;
}

export interface DieselNorms {
  id?: string;
  fleet_number: string;
  expected_km_per_litre: number;
  tolerance_percentage: number;
  min_acceptable: number;
  max_acceptable: number;
  last_updated: string;
  updated_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DriverBehaviorEvent {
  id: string;
  driver_name: string;
  event_type: string;
  event_date: string;
  event_time?: string;
  location?: string;
  fleet_number?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  description: string;
  witness_name?: string;
  witness_statement?: string;
  corrective_action_taken?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  car_report_id?: string;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  category?: string;
  assigned_to?: string;
  due_date?: string;
  completed_date?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  comments?: ActionItemComment[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItemComment {
  id: string;
  action_item_id: string;
  comment: string;
  created_by: string;
  created_at: string;
}

export interface CARReport {
  id: string;
  report_number: string;
  driver_name: string;
  fleet_number?: string;
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  immediate_action_taken?: string;
  root_cause_analysis?: string;
  corrective_actions?: string;
  preventive_measures?: string;
  responsible_person?: string;
  target_completion_date?: string;
  actual_completion_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'closed';
  reference_event_id?: string;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface MissedLoad {
  id: string;
  load_reference?: string;
  customer_name?: string;
  client_name?: string;
  load_request_date?: string;
  scheduled_date?: string;
  missed_date?: string;
  requested_pickup_date?: string;
  requested_delivery_date?: string;
  route?: string;
  estimated_revenue?: number;
  estimated_loss?: number;
  actual_loss?: number;
  currency?: string;
  reason: string;
  reason_category?: string;
  reason_description?: string;
  responsible_party?: string;
  resolution_status?: 'pending' | 'resolved' | 'lost_opportunity' | 'rescheduled';
  status?: 'open' | 'recovering' | 'recovered' | 'lost';
  follow_up_required?: boolean;
  competitor_won?: boolean;
  impact?: 'low' | 'medium' | 'high';
  recorded_by?: string;
  recorded_at?: string;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolved_date?: string;
  compensation_offered?: number;
  compensation_notes?: string;
  recovery_plan?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPerformance {
  customerName: string;
  totalTrips: number;
  totalRevenue: number;
  currency: 'ZAR' | 'USD';
  averagePaymentDays: number;
  paymentScore: number;
  lastTripDate: string;
  riskLevel: 'low' | 'medium' | 'high';
  isAtRisk: boolean;
  isProfitable: boolean;
  isTopClient: boolean;
  daysSinceLastTrip: number;
  clientType: 'internal' | 'external';
}

export interface DriverPerformance {
  driver_name: string;
  behavior_score: number;
  total_behavior_events: number;
  total_points: number;
  total_trips: number;
  total_distance: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  improvement_trend: 'improving' | 'stable' | 'declining';
}