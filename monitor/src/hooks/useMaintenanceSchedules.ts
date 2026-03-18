import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceSchedule {
  id: string;
  title: string;
  description: string | null;
  vehicle_id: string | null;
  schedule_type: 'time_based' | 'odometer_based' | 'both';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  is_active: boolean;
  assigned_to: string | null;
  notes: string | null;

  // Time-based fields
  interval_days: number | null;
  next_due_date: string | null;
  last_completed_date: string | null;

  // Odometer-based fields
  odometer_interval_km: number | null;
  last_odometer_reading: number | null;

  created_at: string;
  updated_at: string;

  // Joined fields - fetched separately
  vehicles?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

// Define the raw schedule type from the database
interface RawMaintenanceSchedule {
  id: string;
  title: string | null;
  description: string | null;
  vehicle_id: string | null;
  schedule_type: string | null;
  category: string | null;
  priority: string | null;
  is_active: boolean;
  assigned_to: string | null;
  notes: string | null;
  interval_days: number | null;
  next_due_date: string | null;
  last_completed_date: string | null;
  odometer_interval_km: number | null;
  last_odometer_reading: number | null;
  created_at: string;
  updated_at: string;
}

interface VehicleInfo {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
}

export function useMaintenanceSchedules(vehicleId?: string) {
  return useQuery({
    queryKey: ['maintenance-schedules', vehicleId],
    queryFn: async () => {
      // First, fetch maintenance schedules without join
      let query = supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data: schedules, error } = await query;

      if (error) {
        console.error('Error fetching maintenance schedules:', error);
        throw error;
      }

      if (!schedules || schedules.length === 0) {
        return [];
      }

      // Cast the raw data to our type
      const rawSchedules = schedules as RawMaintenanceSchedule[];

      // Get unique vehicle IDs
      const vehicleIds = rawSchedules
        .map(s => s.vehicle_id)
        .filter((id): id is string => id !== null);

      // Fetch vehicle data separately if there are any vehicle IDs
      let vehiclesMap: Record<string, VehicleInfo> = {};

      if (vehicleIds.length > 0) {
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('id, fleet_number, registration_number, make, model')
          .in('id', vehicleIds);

        if (vehiclesError) {
          console.error('Error fetching vehicles:', vehiclesError);
        } else if (vehicles) {
          vehiclesMap = vehicles.reduce((acc, v) => {
            acc[v.id] = v;
            return acc;
          }, {} as Record<string, VehicleInfo>);
        }
      }

      // Combine the data
      const combinedSchedules = rawSchedules.map((schedule) => {
        const vehicle = schedule.vehicle_id ? vehiclesMap[schedule.vehicle_id] : null;

        return {
          id: schedule.id,
          title: schedule.title || 'Maintenance',
          description: schedule.description,
          vehicle_id: schedule.vehicle_id,
          schedule_type: (schedule.schedule_type as 'time_based' | 'odometer_based' | 'both') || 'time_based',
          category: schedule.category || 'service',
          priority: (schedule.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
          is_active: schedule.is_active ?? true,
          assigned_to: schedule.assigned_to,
          notes: schedule.notes,
          interval_days: schedule.interval_days,
          next_due_date: schedule.next_due_date,
          last_completed_date: schedule.last_completed_date,
          odometer_interval_km: schedule.odometer_interval_km,
          last_odometer_reading: schedule.last_odometer_reading,
          created_at: schedule.created_at,
          updated_at: schedule.updated_at,
          vehicles: vehicle ? {
            fleet_number: vehicle.fleet_number,
            registration_number: vehicle.registration_number,
            make: vehicle.make,
            model: vehicle.model,
          } : null,
        };
      });

      return combinedSchedules as MaintenanceSchedule[];
    },
  });
}