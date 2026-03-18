import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  center_lat?: number;
  center_lng?: number;
  radius?: number;
  type: string;
  is_active?: boolean;
  color?: string;
  groups?: string;
}

/**
 * Hook to fetch geofences for location selection
 */
export const useGeofences = () => {
  return useQuery({
    queryKey: ["geofences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geofences" as never)
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return (data || []) as unknown as Geofence[];
    },
  });
};