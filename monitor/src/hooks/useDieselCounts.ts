import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDieselCounts() {
  return useQuery({
    queryKey: ["diesel-counts"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("diesel_records")
        .select("id", { count: "exact", head: true })
        .eq("requires_debrief", true)
        .eq("debrief_signed", false)
        .not("fleet_number", "is", null)
        .not("driver_name", "is", null);

      if (error) throw error;

      return {
        total: count ?? 0,
        active: count ?? 0,
      };
    },
    refetchInterval: 30000,
  });
}