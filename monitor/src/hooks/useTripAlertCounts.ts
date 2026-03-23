import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTripAlertCounts() {
  return useQuery({
    queryKey: ["trip-alert-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("severity")
        .in("category", ["duplicate_pod", "load_exception", "fuel_anomaly"])
        .eq("status", "active"); // Only count active alerts

      if (error) throw error;

      const counts = {
        total: data?.length || 0,
        active: data?.length || 0,
        critical: data?.filter(a => a.severity === 'critical').length || 0,
        high: data?.filter(a => a.severity === 'high').length || 0,
        medium: data?.filter(a => a.severity === 'medium').length || 0,
        low: data?.filter(a => a.severity === 'low').length || 0,
      };

      return counts;
    },
    refetchInterval: 30000,
  });
}