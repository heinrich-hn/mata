import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDieselCounts() {
  return useQuery({
    queryKey: ["diesel-counts"],
    queryFn: async () => {
      // Get all active fuel anomaly alerts
      const { data, error } = await supabase
        .from("alerts")
        .select("severity, metadata")
        .eq("category", "fuel_anomaly")
        .eq("status", "active");

      if (error) throw error;

      // Filter to ONLY missing debrief alerts
      const missingDebriefAlerts = (data || []).filter(alert => {
        const metadata = alert.metadata as { issue_type?: string };
        return metadata?.issue_type === 'missing_debrief';
      });

      const counts = {
        total: missingDebriefAlerts.length,
        active: missingDebriefAlerts.length,
        critical: missingDebriefAlerts.filter(a => a.severity === 'critical').length || 0,
        high: missingDebriefAlerts.filter(a => a.severity === 'high').length || 0,
        medium: missingDebriefAlerts.filter(a => a.severity === 'medium').length || 0,
        low: missingDebriefAlerts.filter(a => a.severity === 'low').length || 0,
      };

      return counts;
    },
    refetchInterval: 30000,
  });
}