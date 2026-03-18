import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFaultCounts() {
  return useQuery({
    queryKey: ["fault-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_faults")
        .select("severity")
        .eq("status", "identified"); // Only count identified faults (not acknowledged)

      if (error) throw error;

      const counts = {
        total: data?.length || 0,
        active: data?.length || 0,
        critical: data?.filter(f => f.severity === "critical").length || 0,
        high: data?.filter(f => f.severity === "high").length || 0,
        medium: data?.filter(f => f.severity === "medium").length || 0,
        low: data?.filter(f => f.severity === "low").length || 0,
        identified: data?.length || 0, // All are identified
        acknowledged: 0, // Always 0 since we're not counting acknowledged
      };

      return counts;
    },
    refetchInterval: 30000,
  });
}