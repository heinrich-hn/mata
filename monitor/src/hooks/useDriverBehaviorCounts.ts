import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDriverBehaviorCounts() {
    return useQuery({
        queryKey: ["driver-behavior-counts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("driver_behavior_events")
                .select("severity")
                .in("status", ["pending", "identified"]);

            if (error) throw error;

            return {
                total: data?.length || 0,
                active: data?.length || 0,
                critical: data?.filter(e => e.severity === "critical").length || 0,
                high: data?.filter(e => e.severity === "high").length || 0,
                medium: data?.filter(e => e.severity === "medium").length || 0,
                low: data?.filter(e => e.severity === "low").length || 0,
            };
        },
        refetchInterval: 60000,
    });
}
