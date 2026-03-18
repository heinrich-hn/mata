import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeDriverBehaviorEvents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("driver-behavior-events-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_behavior_events",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};