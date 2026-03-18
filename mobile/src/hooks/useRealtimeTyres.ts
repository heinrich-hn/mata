import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeTyres = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tyres-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyres",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyres"] });
          queryClient.invalidateQueries({ queryKey: ["tyres_health"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyre_inventory",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyre_inventory"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyre_inspections",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyre_inspections"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyre_positions",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyre_positions"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyre_configs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyre_configs"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "axle_configurations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["axle_configurations"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tyre_positions_detailed",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tyre_positions_detailed"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};