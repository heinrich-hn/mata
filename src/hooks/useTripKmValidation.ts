import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface KmValidationResult {
    /** Whether there's a km mismatch (gap between previous ending_km and this starting_km) */
    hasMismatch: boolean;
    /** The previous trip's ending_km for the same vehicle */
    previousEndingKm: number | null;
    /** The previous trip's trip_number */
    previousTripNumber: string | null;
    /** The previous trip's arrival_date */
    previousArrivalDate: string | null;
    /** The gap in km (starting_km - previousEndingKm). Positive = gap, negative = overlap */
    kmGap: number | null;
    /** Whether data is still loading */
    isLoading: boolean;
    /** Human-readable message describing the mismatch */
    message: string | null;
}

/**
 * Validates that a trip's starting_km matches the previous trip's ending_km
 * for the same vehicle (by fleet_vehicle_id). Returns mismatch details.
 */
export function useTripKmValidation(
    tripId: string | undefined,
    fleetVehicleId: string | undefined | null,
    startingKm: number | undefined | null,
    departureDate: string | undefined | null,
): KmValidationResult {
    const { data, isLoading } = useQuery({
        queryKey: ['trip-km-validation', tripId, fleetVehicleId, departureDate],
        queryFn: async () => {
            if (!fleetVehicleId) return null;

            // Find the most recent completed or active trip for this vehicle
            // that departs before the current trip
            let query = supabase
                .from('trips')
                .select('id, trip_number, ending_km, arrival_date, departure_date')
                .eq('fleet_vehicle_id', fleetVehicleId)
                .not('ending_km', 'is', null)
                .in('status', ['completed', 'active']);

            if (tripId) {
                query = query.neq('id', tripId);
            }

            if (departureDate) {
                query = query.lte('departure_date', departureDate);
            }

            const { data: prevTrips, error } = await query
                .order('departure_date', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Error fetching previous trip for km validation:', error);
                return null;
            }

            if (!prevTrips || prevTrips.length === 0) return null;

            return {
                previousEndingKm: prevTrips[0].ending_km as number,
                previousTripNumber: prevTrips[0].trip_number as string | null,
                previousArrivalDate: (prevTrips[0].arrival_date || prevTrips[0].departure_date) as string | null,
            };
        },
        enabled: !!fleetVehicleId,
        staleTime: 30_000,
    });

    if (isLoading || !data || startingKm == null) {
        return {
            hasMismatch: false,
            previousEndingKm: data?.previousEndingKm ?? null,
            previousTripNumber: data?.previousTripNumber ?? null,
            previousArrivalDate: data?.previousArrivalDate ?? null,
            kmGap: null,
            isLoading,
            message: null,
        };
    }

    const gap = startingKm - data.previousEndingKm;
    const hasMismatch = gap !== 0;

    const message = hasMismatch
        ? `Starting KM (${startingKm.toLocaleString()}) does not match previous trip ${data.previousTripNumber || '(unknown)'}'s ending KM (${data.previousEndingKm.toLocaleString()}). Gap: ${gap > 0 ? '+' : ''}${gap.toLocaleString()} km.`
        : null;

    return {
        hasMismatch,
        previousEndingKm: data.previousEndingKm,
        previousTripNumber: data.previousTripNumber,
        previousArrivalDate: data.previousArrivalDate,
        kmGap: gap,
        isLoading,
        message,
    };
}

/**
 * Standalone function to check km mismatch for a specific trip.
 * Use this in onSubmit handlers where hook-based validation isn't appropriate.
 */
export async function checkTripKmMismatch(
    tripId: string,
    fleetVehicleId: string,
    startingKm: number,
    departureDate: string | null,
): Promise<{ hasMismatch: boolean; message: string | null; previousEndingKm: number | null }> {
    let query = supabase
        .from('trips')
        .select('id, trip_number, ending_km, arrival_date, departure_date')
        .eq('fleet_vehicle_id', fleetVehicleId)
        .not('ending_km', 'is', null)
        .neq('id', tripId)
        .in('status', ['completed', 'active']);

    if (departureDate) {
        query = query.lte('departure_date', departureDate);
    }

    const { data: prevTrips, error } = await query
        .order('departure_date', { ascending: false })
        .limit(1);

    if (error || !prevTrips || prevTrips.length === 0) {
        return { hasMismatch: false, message: null, previousEndingKm: null };
    }

    const prevEndingKm = prevTrips[0].ending_km as number;
    const gap = startingKm - prevEndingKm;

    if (gap === 0) {
        return { hasMismatch: false, message: null, previousEndingKm: prevEndingKm };
    }

    const prevTripNumber = prevTrips[0].trip_number || '(unknown)';
    return {
        hasMismatch: true,
        message: `Starting KM (${startingKm.toLocaleString()}) does not match previous trip ${prevTripNumber}'s ending KM (${prevEndingKm.toLocaleString()}). Gap: ${gap > 0 ? '+' : ''}${gap.toLocaleString()} km.`,
        previousEndingKm: prevEndingKm,
    };
}
