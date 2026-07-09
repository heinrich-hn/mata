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
 * Compare two trip numbers for ordering.
 * Handles numeric POD patterns like "1", "1.1", "2", "10.1" etc.
 * Falls back to lexicographic comparison for non-numeric trip numbers.
 */
export function compareTripNumbers(a: string, b: string): number {
    const numA = parseFloat(a);
    const numB = parseFloat(b);

    // Both are numeric (handles 1, 1.1, 2, 2.1, 10, etc.)
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    // Try to extract trailing numeric parts (e.g. "POD-1.1" → 1.1)
    const trailingA = a.match(/(\d+(?:\.\d+)?)$/);
    const trailingB = b.match(/(\d+(?:\.\d+)?)$/);

    if (trailingA && trailingB) {
        return parseFloat(trailingA[1]) - parseFloat(trailingB[1]);
    }

    // Fallback to lexicographic
    return a.localeCompare(b);
}

/**
 * Compare two trips for their real-world sequence on a vehicle.
 * POD (trip_number) order is the primary ranking. Dates are only used to
 * order trips *within* the same POD group (same integer part, e.g. "12834"
 * vs "12834.1"), where the sub-POD may have been driven before the main POD.
 * Across different POD numbers (e.g. 12088 vs 12089), POD order always wins
 * so imprecise stored dates cannot reorder the chain.
 */
export function compareTripSequence(
    a: { trip_number: string; departure_date?: string | null; arrival_date?: string | null },
    b: { trip_number: string; departure_date?: string | null; arrival_date?: string | null },
): number {
    const numA = parseFloat(a.trip_number);
    const numB = parseFloat(b.trip_number);
    const sameGroup = !isNaN(numA) && !isNaN(numB) && Math.floor(numA) === Math.floor(numB);

    if (!sameGroup) {
        const cmp = compareTripNumbers(a.trip_number, b.trip_number);
        if (cmp !== 0) return cmp;
    }

    // Same POD group (e.g. "12834" and "12834.1") or identical POD —
    // order by actual run dates. Normalize to date-only strings so
    // timestamps don't cause spurious ordering.
    const depA = (a.departure_date || a.arrival_date || '').slice(0, 10);
    const depB = (b.departure_date || b.arrival_date || '').slice(0, 10);
    if (depA && depB && depA !== depB) return depA.localeCompare(depB);

    const arrA = (a.arrival_date || a.departure_date || '').slice(0, 10);
    const arrB = (b.arrival_date || b.departure_date || '').slice(0, 10);
    if (arrA && arrB && arrA !== arrB) return arrA.localeCompare(arrB);

    return compareTripNumbers(a.trip_number, b.trip_number);
}

/**
 * Given a list of vehicle trips (with trip_number, dates),
 * find the trip immediately preceding the given trip in real-world sequence.
 * Ranked by POD order, with dates ordering sub-PODs within the same POD group.
 */
function findPreviousTrip<T extends { trip_number: string; departure_date?: string | null; arrival_date?: string | null }>(
    vehicleTrips: T[],
    currentTripNumber: string,
    currentTripId?: string,
    tripIdAccessor?: (t: T) => string,
): T | null {
    // Sort ascending by real-world trip sequence (dates first, POD tiebreaker)
    const sorted = [...vehicleTrips].sort(compareTripSequence);

    // Find the index of the current trip in the sorted list
    let currentIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
        const t = sorted[i];
        const id = tripIdAccessor ? tripIdAccessor(t) : null;
        // Match by trip ID if available, otherwise by trip_number
        if (currentTripId && id && id === currentTripId) {
            currentIdx = i;
            break;
        }
        if (t.trip_number === currentTripNumber) {
            currentIdx = i;
            break;
        }
    }

    if (currentIdx <= 0) return null;

    // The previous trip is the one right before in sorted order
    return sorted[currentIdx - 1];
}

/**
 * Validates that a trip's starting_km matches the previous trip's ending_km
 * for the same vehicle (by fleet_vehicle_id). Returns mismatch details.
 * Uses trip_number (POD sequence) as primary ordering, not just departure_date.
 */
export function useTripKmValidation(
    tripId: string | undefined,
    fleetVehicleId: string | undefined | null,
    startingKm: number | undefined | null,
    departureDate: string | undefined | null,
    tripNumber?: string | undefined | null,
): KmValidationResult {
    const { data, isLoading } = useQuery({
        queryKey: ['trip-km-validation', tripId, fleetVehicleId, tripNumber, departureDate],
        queryFn: async () => {
            if (!fleetVehicleId) return null;

            // Fetch all trips for this vehicle that have ending_km
            const { data: allTrips, error } = await supabase
                .from('trips')
                .select('id, trip_number, ending_km, arrival_date, departure_date')
                .eq('fleet_vehicle_id', fleetVehicleId)
                .not('ending_km', 'is', null)
                .in('status', ['completed', 'active']);

            if (error) {
                console.error('Error fetching previous trip for km validation:', error);
                return null;
            }

            if (!allTrips || allTrips.length === 0) return null;

            // Use trip_number (POD) sequence to find the previous trip
            const currentTripNumber = tripNumber || '';
            const prev = findPreviousTrip(
                allTrips.map(t => ({
                    id: t.id as string,
                    trip_number: (t.trip_number as string) || '',
                    ending_km: t.ending_km as number,
                    arrival_date: (t.arrival_date || t.departure_date) as string | null,
                    departure_date: t.departure_date as string | null,
                })),
                currentTripNumber,
                tripId,
                (t) => t.id,
            );

            if (!prev) return null;

            return {
                previousEndingKm: prev.ending_km,
                previousTripNumber: prev.trip_number,
                previousArrivalDate: prev.arrival_date,
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
 * Uses trip_number (POD sequence) as primary ordering to find the previous trip.
 */
export async function checkTripKmMismatch(
    tripId: string,
    fleetVehicleId: string,
    startingKm: number,
    departureDate: string | null,
    tripNumber?: string | null,
): Promise<{ hasMismatch: boolean; message: string | null; previousEndingKm: number | null }> {
    // Fetch all trips for this vehicle that have ending_km
    const { data: allTrips, error } = await supabase
        .from('trips')
        .select('id, trip_number, ending_km, arrival_date, departure_date')
        .eq('fleet_vehicle_id', fleetVehicleId)
        .not('ending_km', 'is', null)
        .neq('id', tripId)
        .in('status', ['completed', 'active']);

    if (error || !allTrips || allTrips.length === 0) {
        return { hasMismatch: false, message: null, previousEndingKm: null };
    }

    const currentTripNumber = tripNumber || '';

    // Add the current trip placeholder so findPreviousTrip can locate its position
    const allWithCurrent = [
        ...allTrips.map(t => ({
            id: t.id as string,
            trip_number: (t.trip_number as string) || '',
            ending_km: t.ending_km as number,
            departure_date: t.departure_date as string | null,
            arrival_date: t.arrival_date as string | null,
        })),
        { id: tripId, trip_number: currentTripNumber, ending_km: 0, departure_date: departureDate, arrival_date: null as string | null },
    ];

    const prev = findPreviousTrip(
        allWithCurrent,
        currentTripNumber,
        tripId,
        (t) => t.id,
    );

    if (!prev || prev.id === tripId) {
        return { hasMismatch: false, message: null, previousEndingKm: null };
    }

    const prevEndingKm = prev.ending_km;
    const gap = startingKm - prevEndingKm;

    if (gap === 0) {
        return { hasMismatch: false, message: null, previousEndingKm: prevEndingKm };
    }

    const prevTripNumber = prev.trip_number || '(unknown)';
    return {
        hasMismatch: true,
        message: `Starting KM (${startingKm.toLocaleString()}) does not match previous trip ${prevTripNumber}'s ending KM (${prevEndingKm.toLocaleString()}). Gap: ${gap > 0 ? '+' : ''}${gap.toLocaleString()} km.`,
        previousEndingKm: prevEndingKm,
    };
}
