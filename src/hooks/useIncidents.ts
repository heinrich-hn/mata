import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Incident {
  id: string;
  incident_number: string;
  incident_date: string;
  incident_time: string;
  vehicle_id: string | null;
  vehicle_number: string | null;
  location_id: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  incident_type: string;
  description: string | null;
  weather_condition: string | null;
  reported_by: string;
  driver_id: string | null;
  driver_name: string | null;
  status: "open" | "processing" | "closed" | "claimed";
  insurance_number: string | null;
  total_cost: number | null;
  insurance_claim_amount: number | null;
  notes: string | null;
  resolution_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  images: Array<{
    url: string;
    name: string;
    uploaded_at: string;
    blob_path?: string;
  }>;
  severity_rating: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  vehicles?: {
    registration_number: string;
    fleet_number: string | null;
    make: string;
    model: string;
  } | null;
  drivers?: {
    first_name: string;
    last_name: string;
  } | null;
  predefined_locations?: {
    name: string;
  } | null;
}

export const useIncidents = (statusFilter?: string) => {
  return useQuery({
    queryKey: ["incidents", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("incidents")
        .select(
          `
          *,
          vehicles (
            registration_number,
            fleet_number,
            make,
            model
          ),
          drivers (
            first_name,
            last_name
          ),
          predefined_locations (
            name
          )
        `
        )
        .order("incident_date", { ascending: false })
        .order("incident_time", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as "open" | "processing" | "closed" | "claimed");
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Incident[];
    },
  });
};

export const useIncident = (incidentId: string | null) => {
  return useQuery({
    queryKey: ["incident", incidentId],
    queryFn: async () => {
      if (!incidentId) return null;

      const { data, error } = await supabase
        .from("incidents")
        .select(
          `
          *,
          vehicles (
            registration_number,
            fleet_number,
            make,
            model
          ),
          drivers (
            first_name,
            last_name
          ),
          predefined_locations (
            name
          )
        `
        )
        .eq("id", incidentId)
        .single();

      if (error) throw error;
      return data as Incident;
    },
    enabled: !!incidentId,
  });
};