import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGeofenceCounts() {
    return useQuery({
        queryKey: ["geofence-counts"],
        queryFn: async () => {
            // Count recent geofence events (last 24h)
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data, error } = await supabase
                .from("geofence_events")
                .select("event_type")
                .gte("event_timestamp", since);

            if (error) throw error;

            return {
                total: data?.length || 0,
                active: data?.length || 0,
                entries: data?.filter(e => e.event_type === "entered").length || 0,
                exits: data?.filter(e => e.event_type === "exited").length || 0,
                dwells: data?.filter(e => e.event_type === "dwell").length || 0,
            };
        },
        refetchInterval: 60000,
    });
}
