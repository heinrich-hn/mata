import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compareTripNumbers } from '@/hooks/useTripKmValidation';

export interface PreviousTripHighlights {
    id: string;
    trip_number: string;
    route: string | null;
    driver_name: string | null;
    client_name: string | null;
    departure_date: string | null;
    arrival_date: string | null;
    starting_km: number | null;
    ending_km: number | null;
    distance_km: number | null;
    base_revenue: number | null;
    revenue_currency: string | null;
    status: string | null;
}

export function usePreviousTripDetails(
    tripId: string | undefined,
    fleetVehicleId: string | undefined | null,
    tripNumber: string | undefined | null,
) {
    return useQuery({
        queryKey: ['previous-trip-details', tripId, fleetVehicleId, tripNumber],
        queryFn: async (): Promise<PreviousTripHighlights | null> => {
            if (!fleetVehicleId) return null;

            const { data: allTrips, error } = await supabase
                .from('trips')
                .select('id, trip_number, route, driver_name, client_name, departure_date, arrival_date, starting_km, ending_km, distance_km, base_revenue, revenue_currency, status')
                .eq('fleet_vehicle_id', fleetVehicleId)
                .in('status', ['completed', 'active']);

            if (error || !allTrips || allTrips.length === 0) return null;

            const currentTripNumber = tripNumber || '';

            // Sort ascending by POD sequence, departure_date as tiebreaker
            const sorted = [...allTrips].sort((a, b) => {
                const cmp = compareTripNumbers(a.trip_number || '', b.trip_number || '');
                if (cmp !== 0) return cmp;
                return (a.departure_date || '').localeCompare(b.departure_date || '');
            });

            // Find the current trip index
            let currentIdx = -1;
            for (let i = sorted.length - 1; i >= 0; i--) {
                if (tripId && sorted[i].id === tripId) {
                    currentIdx = i;
                    break;
                }
                if ((sorted[i].trip_number || '') === currentTripNumber) {
                    currentIdx = i;
                    break;
                }
            }

            if (currentIdx <= 0) return null;

            const prev = sorted[currentIdx - 1];
            return {
                id: prev.id,
                trip_number: prev.trip_number || '',
                route: prev.route,
                driver_name: prev.driver_name,
                client_name: prev.client_name,
                departure_date: prev.departure_date,
                arrival_date: prev.arrival_date,
                starting_km: prev.starting_km,
                ending_km: prev.ending_km,
                distance_km: prev.distance_km,
                base_revenue: prev.base_revenue,
                revenue_currency: prev.revenue_currency,
                status: prev.status,
            };
        },
        enabled: !!fleetVehicleId && !!tripNumber,
        staleTime: 30_000,
    });
}

/**
 * Fetches the latest trip for a vehicle (by wialon vehicle_id or fleet_vehicle_id).
 * Useful when adding a new trip — shows the most recent trip by POD sequence
 * so the user can see the expected starting KM.
 */
export function useLatestVehicleTrip(
    vehicleId: string | undefined | null,
    vehicleIdField: 'vehicle_id' | 'fleet_vehicle_id' = 'vehicle_id',
) {
    return useQuery({
        queryKey: ['latest-vehicle-trip', vehicleId, vehicleIdField],
        queryFn: async (): Promise<PreviousTripHighlights | null> => {
            if (!vehicleId) return null;

            const { data: allTrips, error } = await supabase
                .from('trips')
                .select('id, trip_number, route, driver_name, client_name, departure_date, arrival_date, starting_km, ending_km, distance_km, base_revenue, revenue_currency, status')
                .eq(vehicleIdField, vehicleId)
                .in('status', ['completed', 'active']);

            if (error || !allTrips || allTrips.length === 0) return null;

            // Sort ascending by POD sequence, departure_date as tiebreaker
            const sorted = [...allTrips].sort((a, b) => {
                const cmp = compareTripNumbers(a.trip_number || '', b.trip_number || '');
                if (cmp !== 0) return cmp;
                return (a.departure_date || '').localeCompare(b.departure_date || '');
            });

            // Return the last one (most recent by POD sequence)
            const last = sorted[sorted.length - 1];
            return {
                id: last.id,
                trip_number: last.trip_number || '',
                route: last.route,
                driver_name: last.driver_name,
                client_name: last.client_name,
                departure_date: last.departure_date,
                arrival_date: last.arrival_date,
                starting_km: last.starting_km,
                ending_km: last.ending_km,
                distance_km: last.distance_km,
                base_revenue: last.base_revenue,
                revenue_currency: last.revenue_currency,
                status: last.status,
            };
        },
        enabled: !!vehicleId,
        staleTime: 30_000,
    });
}
