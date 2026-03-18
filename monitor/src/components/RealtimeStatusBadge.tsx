import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Status = "connected" | "connecting" | "offline";

export default function RealtimeStatusBadge() {
  const [status, setStatus] = useState<Status>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const channel = supabase
      .channel("monitor-status-ping")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        setLastUpdate(new Date());
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("connected");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("offline");
        else setStatus("connecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* Professional status colors - simplified */
  const dotColor =
    status === "connected" ? "bg-green-500" :
      status === "connecting" ? "bg-amber-500" :
        "bg-red-500";

  const label =
    status === "connected" ? "Live" :
      status === "connecting" ? "Connecting" :
        "Offline";

  const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
  const timeLabel = secondsAgo < 60
    ? secondsAgo < 5
      ? "just now"
      : `${secondsAgo}s ago`
    : `${Math.floor(secondsAgo / 60)}m ago`;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border text-xs">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          dotColor,
          status === "connected" && "animate-pulse"
        )}
      />
      <span className="font-medium text-foreground">
        {label}
      </span>
      {status === "connected" && (
        <span className="text-muted-foreground ml-0.5">
          · {timeLabel}
        </span>
      )}
    </div>
  );
}