import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIncidentCounts() {
    return useQuery({
        queryKey: ["incident-counts"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("incidents")
                .select("severity_rating")
                .in("status", ["open", "processing"]);

            if (error) throw error;

            return {
                total: data?.length || 0,
                active: data?.length || 0,
                critical: data?.filter(i => (i.severity_rating ?? 0) >= 4).length || 0,
                high: data?.filter(i => i.severity_rating === 3).length || 0,
                medium: data?.filter(i => i.severity_rating === 2).length || 0,
                low: data?.filter(i => (i.severity_rating ?? 0) <= 1).length || 0,
            };
        },
        refetchInterval: 30000,
    });
}
