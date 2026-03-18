import { supabase } from '@/integrations/supabase/client';

export async function getVehicleLatestKm(vehicleIds: string[]): Promise<Record<string, number>> {
  if (!vehicleIds.length) return {};

  const { data: trips, error } = await supabase
    .from('trips')
    .select('vehicle_id, ending_km')
    .in('vehicle_id', vehicleIds)
    .order('departure_date', { ascending: false });

  if (error) {
    console.error('Error fetching vehicle km:', error);
    return {};
  }

  const kmMap: Record<string, number> = {};

  // Get the most recent trip for each vehicle
  vehicleIds.forEach(id => {
    const vehicleTrips = trips?.filter(t => t.vehicle_id === id) || [];
    if (vehicleTrips.length > 0) {
      kmMap[id] = vehicleTrips[0].ending_km || 0;
    } else {
      kmMap[id] = 0;
    }
  });

  return kmMap;
}

export function calculateKmStatus(
  intervalKm: number,
  lastReading: number,
  currentReading: number
): {
  nextServiceKm: number;
  remainingKm: number;
  progressPercent: number;
  isOverdue: boolean;
  isApproaching: boolean;
} {
  const nextServiceKm = lastReading + intervalKm;
  const remainingKm = nextServiceKm - currentReading;
  const progressPercent = Math.min(Math.round((currentReading - lastReading) / intervalKm * 100), 150);
  const isOverdue = remainingKm < 0;
  const isApproaching = !isOverdue && remainingKm <= intervalKm * 0.15;

  return {
    nextServiceKm,
    remainingKm,
    progressPercent,
    isOverdue,
    isApproaching,
  };
}