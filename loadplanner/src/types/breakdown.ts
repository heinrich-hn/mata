export type BreakdownSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BreakdownCategory = 'mechanical' | 'electrical' | 'tyre' | 'engine' | 'transmission' | 'brakes' | 'cooling' | 'fuel_system' | 'other';
export type BreakdownStatus = 'reported' | 'assistance_dispatched' | 'under_repair' | 'resolved' | 'towed';

export interface Breakdown {
    id: string;
    breakdown_number: string;
    load_id: string | null;
    fleet_vehicle_id: string | null;
    driver_id: string | null;
    breakdown_date: string;
    location: string | null;
    description: string;
    severity: BreakdownSeverity;
    category: BreakdownCategory;
    status: BreakdownStatus;
    resolution_notes: string | null;
    resolved_at: string | null;
    sent_to_main_app: boolean;
    sent_at: string | null;
    main_app_breakdown_id: string | null;
    reported_by: string | null;
    created_at: string;
    updated_at: string;
    // Joined relations
    load?: { id: string; load_id: string } | null;
    fleet_vehicle?: { id: string; vehicle_id: string; type: string } | null;
    driver?: { id: string; name: string; contact: string } | null;
}

export interface BreakdownInsert {
    breakdown_number: string;
    load_id?: string | null;
    fleet_vehicle_id?: string | null;
    driver_id?: string | null;
    breakdown_date: string;
    location?: string | null;
    description: string;
    severity: BreakdownSeverity;
    category: BreakdownCategory;
    status?: BreakdownStatus;
    reported_by?: string | null;
}

export const BREAKDOWN_CATEGORIES: { value: BreakdownCategory; label: string }[] = [
    { value: 'mechanical', label: 'Mechanical' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'tyre', label: 'Tyre' },
    { value: 'engine', label: 'Engine' },
    { value: 'transmission', label: 'Transmission' },
    { value: 'brakes', label: 'Brakes' },
    { value: 'cooling', label: 'Cooling System' },
    { value: 'fuel_system', label: 'Fuel System' },
    { value: 'other', label: 'Other' },
];

export const BREAKDOWN_SEVERITIES: { value: BreakdownSeverity; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
];

export const BREAKDOWN_STATUSES: { value: BreakdownStatus; label: string }[] = [
    { value: 'reported', label: 'Reported' },
    { value: 'assistance_dispatched', label: 'Assistance Dispatched' },
    { value: 'under_repair', label: 'Under Repair' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'towed', label: 'Towed' },
];
