import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceHistory {
  id: string;
  schedule_id: string;
  scheduled_date: string;
  completed_date: string | null;
  completed_odometer: number | null;
  status: 'pending' | 'completed' | 'overdue';
  completed_by: string | null;
  notes: string | null;
  duration_hours: number | null;
  created_at: string;
}

export function useMaintenanceHistory(scheduleId: string) {
  return useQuery({
    queryKey: ['maintenance-history', scheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedule_history')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return data as MaintenanceHistory[];
    },
    enabled: !!scheduleId,
  });
}