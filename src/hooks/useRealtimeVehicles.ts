import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeVehicles = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("vehicles-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicles",
        },
        () => {
          // Invalidate vehicles query to refetch data
          queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};