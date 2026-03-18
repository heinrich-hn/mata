import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const useRealtimeIncidents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("incidents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};