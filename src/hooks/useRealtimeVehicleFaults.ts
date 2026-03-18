import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeVehicleFaults = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("vehicle-faults-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicle_faults",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["vehicle-faults"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};