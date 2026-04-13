import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface SystemCostRate {
    id: string;
    rate_key: string;
    rate_type: 'per_km' | 'per_day';
    amount: number;
    display_name: string;
    effective_date: string;
    is_active: boolean;
    created_at: string;
    created_by: string | null;
    notes: string | null;
}

export interface EffectiveRate {
    rate_key: string;
    rate_type: 'per_km' | 'per_day';
    amount: number;
    display_name: string;
    effective_date: string;
}

// All 10 rate keys with their defaults (used as fallback if DB has no data)
const DEFAULT_RATES: EffectiveRate[] = [
    { rate_key: 'repair_maintenance', rate_type: 'per_km', amount: 0.11, display_name: 'Repair & Maintenance per KM', effective_date: '2025-01-01' },
    { rate_key: 'tyre_cost', rate_type: 'per_km', amount: 0.03, display_name: 'Tyre Cost per KM', effective_date: '2025-01-01' },
    { rate_key: 'git_insurance', rate_type: 'per_day', amount: 10.21, display_name: 'GIT Insurance', effective_date: '2025-01-01' },
    { rate_key: 'short_term_insurance', rate_type: 'per_day', amount: 7.58, display_name: 'Short-Term Insurance', effective_date: '2025-01-01' },
    { rate_key: 'tracking_cost', rate_type: 'per_day', amount: 2.47, display_name: 'Tracking Cost', effective_date: '2025-01-01' },
    { rate_key: 'fleet_management_system', rate_type: 'per_day', amount: 1.34, display_name: 'Fleet Management System', effective_date: '2025-01-01' },
    { rate_key: 'licensing', rate_type: 'per_day', amount: 1.32, display_name: 'Licensing', effective_date: '2025-01-01' },
    { rate_key: 'vid_roadworthy', rate_type: 'per_day', amount: 0.41, display_name: 'VID / Roadworthy', effective_date: '2025-01-01' },
    { rate_key: 'wages', rate_type: 'per_day', amount: 16.88, display_name: 'Wages', effective_date: '2025-01-01' },
    { rate_key: 'depreciation', rate_type: 'per_day', amount: 321.17, display_name: 'Depreciation', effective_date: '2025-01-01' },
];

/**
 * Fetch all system cost rate rows from the database (active only).
 */
export const useSystemCostRatesAll = () => {
    return useQuery({
        queryKey: ['system-cost-rates-all'],
        queryFn: async (): Promise<SystemCostRate[]> => {
            const { data, error } = await supabase
                .from('system_cost_rates' as never)
                .select('*')
                .eq('is_active', true)
                .order('rate_key', { ascending: true })
                .order('effective_date', { ascending: false });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.warn('system_cost_rates table not found, using defaults');
                    return [];
                }
                throw error;
            }

            return (data || []) as SystemCostRate[];
        },
        staleTime: 5 * 60 * 1000,
    });
};

/**
 * Derive the effective rate per rate_key for a given date.
 * Picks the row with the latest effective_date <= asOfDate.
 * Falls back to DEFAULT_RATES if no DB rows exist.
 */
export const useEffectiveRates = (asOfDate?: string) => {
    const { data: allRates = [], isLoading, error } = useSystemCostRatesAll();

    const targetDate = asOfDate || new Date().toISOString().split('T')[0];

    const effectiveRates: EffectiveRate[] = DEFAULT_RATES.map(defaultRate => {
        // Find all DB rows for this rate_key where effective_date <= targetDate
        const candidates = allRates
            .filter(r => r.rate_key === defaultRate.rate_key && r.effective_date <= targetDate)
            .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

        if (candidates.length > 0) {
            const best = candidates[0];
            return {
                rate_key: best.rate_key,
                rate_type: best.rate_type as 'per_km' | 'per_day',
                amount: best.amount,
                display_name: best.display_name,
                effective_date: best.effective_date,
            };
        }

        return defaultRate;
    });

    return { effectiveRates, isLoading, error };
};

/**
 * Insert a new rate row (append-only for audit trail).
 */
export const useUpdateCostRate = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (params: {
            rate_key: string;
            rate_type: 'per_km' | 'per_day';
            amount: number;
            display_name: string;
            effective_date: string;
            created_by?: string;
            notes?: string;
        }) => {
            const { data, error } = await supabase
                .from('system_cost_rates' as never)
                .insert({
                    rate_key: params.rate_key,
                    rate_type: params.rate_type,
                    amount: params.amount,
                    display_name: params.display_name,
                    effective_date: params.effective_date,
                    created_by: params.created_by || null,
                    notes: params.notes || null,
                } as never)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-cost-rates-all'] });
            toast({ title: 'Rate Updated', description: 'New rate has been saved successfully.' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update rate',
                variant: 'destructive',
            });
        },
    });
};

/**
 * Pure helper: resolve effective rates for a specific date from a full rate list.
 * Used for bulk recalculation where each trip may have a different departure date.
 */
export function getEffectiveRatesForDate(allRates: SystemCostRate[], asOfDate: string): EffectiveRate[] {
    return DEFAULT_RATES.map(defaultRate => {
        const candidates = allRates
            .filter(r => r.rate_key === defaultRate.rate_key && r.effective_date <= asOfDate)
            .sort((a, b) => b.effective_date.localeCompare(a.effective_date));

        if (candidates.length > 0) {
            const best = candidates[0];
            return {
                rate_key: best.rate_key,
                rate_type: best.rate_type as 'per_km' | 'per_day',
                amount: best.amount,
                display_name: best.display_name,
                effective_date: best.effective_date,
            };
        }

        return defaultRate;
    });
}

// ────────────────────────────────────────────────────────
// Pure helper: calculate system cost entries for a trip
// ────────────────────────────────────────────────────────

interface TripForCostCalc {
    id: string;
    departure_date?: string | null;
    arrival_date?: string | null;
    distance_km?: number | null;
}

function computeTripDays(departureDate?: string | null, arrivalDate?: string | null): number {
    if (!departureDate || !arrivalDate) return 1;
    const start = new Date(departureDate);
    const end = new Date(arrivalDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
}

const formatUSD = (n: number) => `$${n.toFixed(2)}`;

export function calculateSystemCosts(trip: TripForCostCalc, rates: EffectiveRate[], dayAdjustment = 0) {
    const rawDays = computeTripDays(trip.departure_date, trip.arrival_date);
    const tripDays = dayAdjustment > 0 ? Math.max(0, rawDays - dayAdjustment) : rawDays;
    const distanceKm = trip.distance_km ?? 0;
    const today = new Date().toISOString().split('T')[0];
    const costDate = trip.departure_date || today;

    const entries: Array<{
        trip_id: string;
        category: string;
        sub_category: string;
        amount: number;
        currency: string;
        reference_number: string;
        date: string;
        notes: string;
        is_flagged: boolean;
        is_system_generated: boolean;
        investigation_status: string;
        resolved_at: string;
        resolved_by: string;
    }> = [];

    for (const rate of rates) {
        let amount = 0;
        let notes = '';

        if (rate.rate_type === 'per_km') {
            if (distanceKm <= 0) continue;
            amount = rate.amount * distanceKm;
            notes = `${rate.display_name}: ${distanceKm.toLocaleString()} km × ${formatUSD(rate.amount)}/km`;
        } else {
            if (tripDays <= 0) continue;
            amount = rate.amount * tripDays;
            notes = `${rate.display_name}: ${tripDays} day${tripDays !== 1 ? 's' : ''} × ${formatUSD(rate.amount)}/day`;
        }

        entries.push({
            trip_id: trip.id,
            category: 'System Costs',
            sub_category: rate.display_name,
            amount: Math.round(amount * 100) / 100,
            currency: 'USD',
            reference_number: `SYS-${rate.rate_key.toUpperCase()}-${Date.now()}`,
            date: costDate,
            notes,
            is_flagged: false,
            is_system_generated: true,
            investigation_status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by: 'system',
        });
    }

    return entries;
}

/**
 * Generate and insert system costs for a trip.
 * Replaces any existing system costs — no duplicates, no verification needed.
 */
export async function generateAndInsertSystemCosts(
    trip: TripForCostCalc,
    rates: EffectiveRate[]
): Promise<{ inserted: number; skipped: boolean }> {
    const entries = calculateSystemCosts(trip, rates);
    if (entries.length === 0) {
        return { inserted: 0, skipped: false };
    }

    // Delete any existing system costs for this trip before re-inserting
    const { error: deleteError } = await supabase
        .from('cost_entries')
        .delete()
        .eq('trip_id', trip.id)
        .eq('is_system_generated', true)
        .eq('category', 'System Costs');

    if (deleteError) {
        console.error('Error deleting existing system costs:', deleteError);
        throw deleteError;
    }

    const { error } = await supabase
        .from('cost_entries')
        .insert(entries as never);

    if (error) {
        console.error('Error inserting system costs:', error);
        throw error;
    }

    // Auto-resolve any "no_costs" alert for this trip
    supabase
        .from('alerts')
        .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_note: 'System costs auto-generated',
        } as never)
        .eq('source_type', 'trip')
        .eq('source_id', trip.id)
        .eq('category', 'fuel_anomaly')
        .eq('status', 'active')
        .filter('metadata->>issue_type', 'eq', 'no_costs')
        .then(({ error: resolveErr }) => {
            if (resolveErr) console.error('Error auto-resolving no_costs alert:', resolveErr);
        });

    return { inserted: entries.length, skipped: false };
}

/**
 * Compute per-day overlap adjustments for trips on the same vehicle.
 * When trip B's departure_date equals trip A's arrival_date on the same vehicle,
 * trip B gets 1 day deducted to avoid double-charging per-day costs.
 *
 * @param trips Must include fleet_vehicle_id for grouping
 * @returns Map of trip_id → number of days to deduct
 */
export function computeOverlapAdjustments(
    trips: Array<{ id: string; departure_date: string | null; arrival_date: string | null; fleet_vehicle_id?: string | null }>
): Map<string, number> {
    const adjustments = new Map<string, number>();

    // Group by vehicle
    const byVehicle = new Map<string, typeof trips>();
    for (const trip of trips) {
        const vId = trip.fleet_vehicle_id;
        if (!vId) continue;
        if (!byVehicle.has(vId)) byVehicle.set(vId, []);
        byVehicle.get(vId)!.push(trip);
    }

    for (const [, vehicleTrips] of byVehicle) {
        if (vehicleTrips.length < 2) continue;

        // Sort by departure_date ascending
        const sorted = [...vehicleTrips].sort((a, b) =>
            (a.departure_date || '').localeCompare(b.departure_date || '')
        );

        // Collect all arrival dates into a Set for fast lookup
        const arrivalDates = new Set<string>();
        for (const t of sorted) {
            if (t.arrival_date) arrivalDates.add(t.arrival_date);
        }

        // If a trip's departure_date matches any other trip's arrival_date, deduct 1 day
        for (const t of sorted) {
            if (t.departure_date && arrivalDates.has(t.departure_date)) {
                // Make sure we're not matching our own arrival_date == departure_date
                // (single-day trip). Only count overlaps from OTHER trips.
                const otherHasArrival = sorted.some(
                    other => other.id !== t.id && other.arrival_date === t.departure_date
                );
                if (otherHasArrival) {
                    adjustments.set(t.id, (adjustments.get(t.id) || 0) + 1);
                }
            }
        }
    }

    return adjustments;
}

/**
 * Query the database for overlap days for a single trip.
 * Checks if any other trip on the same vehicle has an arrival_date equal to
 * this trip's departure_date (or this trip's arrival_date equals another's departure).
 *
 * Uses both fleet_vehicle_id and vehicle_id to identify the vehicle.
 *
 * @returns Number of days to deduct from per-day cost calculation
 */
export async function fetchOverlapAdjustmentForTrip(
    tripId: string,
    departureDate: string | null,
    arrivalDate: string | null,
    fleetVehicleId?: string | null,
    vehicleId?: string | null,
): Promise<number> {
    if (!departureDate) return 0;
    if (!fleetVehicleId && !vehicleId) return 0;

    // Build query: find other trips on the same vehicle whose arrival_date == this departure_date
    let query = supabase
        .from('trips')
        .select('id, departure_date, arrival_date')
        .neq('id', tripId)
        .eq('arrival_date', departureDate);

    if (fleetVehicleId) {
        query = query.eq('fleet_vehicle_id', fleetVehicleId);
    } else if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
    }

    const { data: endingOnOurStart } = await query;

    let adjustment = 0;
    if (endingOnOurStart && endingOnOurStart.length > 0) {
        // Another trip on this vehicle ends on the same day we start → deduct 1 day from us
        adjustment += 1;
    }

    return adjustment;
}

/**
 * Recalculate and replace system costs for multiple trips.
 * For each trip, resolves the effective rates as of that trip's departure date,
 * deletes existing system costs, and inserts recalculated ones.
 *
 * @param rateOverrides Optional map of rate_key → amount that overrides the
 *   effective rate for all trips in this batch. Used for past-period corrections
 *   without changing the saved rate schedule.
 */
export async function recalculateSystemCostsForTrips(
    trips: Array<{ id: string; departure_date: string | null; arrival_date: string | null; distance_km: number | null; fleet_vehicle_id?: string | null }>,
    allRates: SystemCostRate[],
    rateOverrides?: Record<string, number>
): Promise<{ updated: number; totalOld: number; totalNew: number }> {
    let updated = 0;
    let totalOld = 0;
    let totalNew = 0;

    // Compute overlap adjustments across the whole batch
    const overlapAdj = computeOverlapAdjustments(trips);

    for (const trip of trips) {
        // 1. Get existing system costs total for comparison
        const { data: existing } = await supabase
            .from('cost_entries')
            .select('amount')
            .eq('trip_id', trip.id)
            .eq('is_system_generated', true)
            .eq('category', 'System Costs');

        const oldTotal = (existing || []).reduce((sum, c) => sum + (c.amount || 0), 0);

        // 2. Resolve effective rates for this trip's departure date, then apply overrides
        const tripDate = trip.departure_date || new Date().toISOString().split('T')[0];
        let rates = getEffectiveRatesForDate(allRates, tripDate);

        if (rateOverrides && Object.keys(rateOverrides).length > 0) {
            rates = rates.map(r =>
                rateOverrides[r.rate_key] !== undefined
                    ? { ...r, amount: rateOverrides[r.rate_key] }
                    : r
            );
        }

        // 3. Delete existing system costs
        const { error: deleteError } = await supabase
            .from('cost_entries')
            .delete()
            .eq('trip_id', trip.id)
            .eq('is_system_generated', true)
            .eq('category', 'System Costs');

        if (deleteError) {
            console.error(`Error deleting system costs for trip ${trip.id}:`, deleteError);
            continue;
        }

        // 4. Calculate and insert new costs (with overlap day adjustment)
        const dayAdj = overlapAdj.get(trip.id) || 0;
        const entries = calculateSystemCosts(trip, rates, dayAdj);
        if (entries.length > 0) {
            const { error: insertError } = await supabase
                .from('cost_entries')
                .insert(entries as never);

            if (insertError) {
                console.error(`Error inserting system costs for trip ${trip.id}:`, insertError);
                continue;
            }
        }

        const newTotal = entries.reduce((sum, c) => sum + c.amount, 0);
        totalOld += oldTotal;
        totalNew += newTotal;
        updated++;
    }

    return { updated, totalOld, totalNew };
}
