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

export function calculateSystemCosts(trip: TripForCostCalc, rates: EffectiveRate[]) {
    const tripDays = computeTripDays(trip.departure_date, trip.arrival_date);
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
 * Generate and insert system costs for a trip (idempotent — skips if already present).
 */
export async function generateAndInsertSystemCosts(
    trip: TripForCostCalc,
    rates: EffectiveRate[]
): Promise<{ inserted: number; skipped: boolean }> {
    // Check if system costs already exist for this trip
    const { data: existing, error: checkError } = await supabase
        .from('cost_entries')
        .select('id')
        .eq('trip_id', trip.id)
        .eq('is_system_generated', true)
        .eq('category', 'System Costs')
        .limit(1);

    if (checkError) {
        console.error('Error checking existing system costs:', checkError);
        throw checkError;
    }

    if (existing && existing.length > 0) {
        return { inserted: 0, skipped: true };
    }

    const entries = calculateSystemCosts(trip, rates);
    if (entries.length === 0) {
        return { inserted: 0, skipped: false };
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
            resolution_comment: 'System costs auto-generated',
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
