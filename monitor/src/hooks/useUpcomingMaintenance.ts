import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

export interface UpcomingMaintenanceItem {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  days_until_due: number;
  vehicle_id: string | null;
  assigned_to: string | null;
  service_type: string | null;
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
  vehicle_id: string | null;
  service_type: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  assigned_to: string | null;
}

interface VehicleInfo {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
}

export function useUpcomingMaintenance(daysThreshold: number = 7) {
  return useQuery({
    queryKey: ['upcoming-maintenance', daysThreshold],
    queryFn: async () => {
      const today = new Date();
      const thresholdDate = addDays(today, daysThreshold).toISOString();

      // SIMPLE QUERY - NO JOIN
      const { data: schedules, error } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('is_active', true)
        .gte('next_due_date', today.toISOString())
        .lte('next_due_date', thresholdDate)
        .order('next_due_date', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming maintenance:', error);
        throw error;
      }

      if (!schedules || schedules.length === 0) {
        return [];
      }

      // Cast to our type
      const typedSchedules = schedules as RawMaintenanceSchedule[];

      // Get unique vehicle IDs
      const vehicleIds = typedSchedules
        .map(s => s.vehicle_id)
        .filter((id): id is string => id !== null);

      // Fetch vehicle data separately
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

      // Combine data
      const upcomingMaintenance: UpcomingMaintenanceItem[] = typedSchedules.map((schedule) => {
        const dueDate = new Date(schedule.next_due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const vehicle = schedule.vehicle_id ? vehiclesMap[schedule.vehicle_id] : null;

        return {
          id: schedule.id,
          title: schedule.service_type || schedule.title || 'Maintenance',
          description: schedule.description ?? null,
          priority: (schedule.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          due_date: schedule.next_due_date,
          days_until_due: daysUntilDue,
          vehicle_id: schedule.vehicle_id,
          assigned_to: schedule.assigned_to ?? null,
          service_type: schedule.service_type ?? null,
          vehicles: vehicle ? {
            fleet_number: vehicle.fleet_number,
            registration_number: vehicle.registration_number,
            make: vehicle.make,
            model: vehicle.model,
          } : null,
        };
      });

      return upcomingMaintenance;
    },
    refetchInterval: 60 * 60 * 1000,
  });
}