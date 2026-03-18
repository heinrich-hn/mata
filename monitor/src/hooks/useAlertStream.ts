import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Alert } from "@/types";

export function useAlertStream() {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Cleanup any previous channel subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("monitor-alert-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const newAlert = payload.new as Alert;

          // Refresh related queries
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
          queryClient.invalidateQueries({ queryKey: ["alert-counts"] });
          queryClient.invalidateQueries({ queryKey: ["kpi-summary"] });
          queryClient.invalidateQueries({ queryKey: ["alert-trend"] });

          // Show simple toast notification without severity
          const message = newAlert.title;
          const description = `${newAlert.source_label ?? "System"} • ${newAlert.message}`;

          toast(message, {
            description,
            duration: 5000,
            style: { borderLeft: `4px solid #3b82f6` },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["alerts"] });
          queryClient.invalidateQueries({ queryKey: ["alert-counts"] });
          queryClient.invalidateQueries({ queryKey: ["kpi-summary"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return {
    isConnected: channelRef.current !== null,
  };
}

// ─── Realtime connection status hook ─────────────────────────────────────────

export function useRealtimeStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("monitor-heartbeat")
      .on("broadcast", { event: "heartbeat" }, () => {
        queryClient.invalidateQueries({ queryKey: ["realtime-status"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}