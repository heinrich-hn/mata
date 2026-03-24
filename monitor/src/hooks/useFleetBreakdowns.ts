import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface FleetBreakdown {
  id: string;
  source_app: string;
  source_breakdown_id: string | null;
  source_breakdown_number: string | null;
  vehicle_registration: string | null;
  vehicle_fleet_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_id: string | null;
  driver_name: string | null;
  breakdown_date: string;
  location: string | null;
  description: string;
  severity: string;
  category: string;
  load_number: string | null;
  status: string;
  linked_inspection_id: string | null;
  linked_job_card_id: string | null;
  workshop_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useFleetBreakdowns() {
  return useQuery<FleetBreakdown[]>({
    queryKey: ["monitor-fleet-breakdowns"],
    queryFn: async () => {
      const { data, error } = await db
        .from("fleet_breakdowns")
        .select("*")
        .order("breakdown_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as FleetBreakdown[];
    },
    refetchInterval: 60000,
  });
}
