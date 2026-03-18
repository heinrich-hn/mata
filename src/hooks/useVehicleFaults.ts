import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const useVehicleFaults = () => {
  return useQuery({
    queryKey: ["vehicle-faults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_faults")
        .select(`
          *,
          vehicles (
            fleet_number,
            registration_number,
            make,
            model
          )
        `)
        .order("reported_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};