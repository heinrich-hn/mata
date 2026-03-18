// Customer retention and missed loads constants

export const MISSED_LOAD_REASONS = [
  { label: 'No Available Vehicle', value: 'no_vehicle' },
  { label: 'Vehicle Breakdown', value: 'vehicle_breakdown' },
  { label: 'Driver Unavailable', value: 'driver_unavailable' },
  { label: 'Short Notice Request', value: 'short_notice' },
  { label: 'Route Not Serviced', value: 'route_not_serviced' },
  { label: 'Capacity Constraints', value: 'capacity_constraints' },
  { label: 'Scheduling Conflict', value: 'scheduling_conflict' },
  { label: 'Pricing Disagreement', value: 'pricing_disagreement' },
  { label: 'Special Equipment Required', value: 'special_equipment' },
  { label: 'Weather/Road Conditions', value: 'weather_conditions' },
  { label: 'Regulatory/Compliance Issue', value: 'regulatory_issue' },
  { label: 'Customer Changed Requirements', value: 'customer_change' },
  { label: 'Competitor Won', value: 'competitor_won' },
  { label: 'Other', value: 'other' }
] as const;

export const RESOLUTION_STATUSES = [
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Lost Opportunity', value: 'lost_opportunity' },
  { label: 'Rescheduled', value: 'rescheduled' }
] as const;

export const IMPACT_LEVELS = [
  { label: 'Low Impact', value: 'low' },
  { label: 'Medium Impact', value: 'medium' },
  { label: 'High Impact', value: 'high' }
] as const;

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
} as const;

// Customer performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  TOP_CLIENT_MIN_TRIPS: 5,
  PROFITABLE_MIN_REVENUE: 50000,
  AT_RISK_DAYS_THRESHOLD: 60,
  HIGH_RISK_DAYS_THRESHOLD: 90,
  PAYMENT_DELAY_MEDIUM_THRESHOLD: 20,
  PAYMENT_DELAY_HIGH_THRESHOLD: 45,
  PAYMENT_SCORE_GOOD: 80,
  PAYMENT_SCORE_FAIR: 60
} as const;