import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect } from "react";

interface GeofenceEvent {
  id: string;
  geofence_zone_id: string;
  vehicle_id: string;
  load_id: string | null;
  event_type: string;
  event_timestamp: string;
}

interface GeofenceZone {
  name: string;
  zone_type: string;
}

interface Load {
  load_number: string;
  customer_name: string;
  status: string;
}

interface Vehicle {
  fleet_number: string;
}

/**
 * Hook to subscribe to real-time geofence events and show notifications
 * Displays toast notifications when vehicles enter/exit geofenced areas
 */
export const useGeofenceNotifications = () => {
  const { toast } = useToast();

  useEffect(() => {
    console.log("🔔 Setting up geofence notifications subscription...");

    // Subscribe to new geofence events
    const channel = supabase
      .channel("geofence-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "geofence_events",
        },
        async (payload: RealtimePostgresChangesPayload<GeofenceEvent>) => {
          const event = payload.new as GeofenceEvent;
          console.log("🔔 New geofence event:", event);

          // Fetch load details if available
          if (event.load_id) {
            const { data: load } = await supabase
              .from("loads")
              .select("load_number, customer_name, status")
              .eq("id", event.load_id)
              .single();

            // Fetch geofence details
            const { data: geofence } = await supabase
              .from("geofence_zones")
              .select("name, zone_type")
              .eq("id", event.geofence_zone_id)
              .single();

            if (load && geofence) {
              const loadData = load as Load;
              const geofenceData = geofence as GeofenceZone;
              const icon = event.event_type === "entered" ? "📍" : "🚀";
              const action = event.event_type === "entered" ? "arrived at" : "departed from";

              toast({
                title: `${icon} Load ${loadData.load_number}`,
                description: `${action} ${geofenceData.name} - Status: ${loadData.status}`,
                duration: 7000,
              });
            }
          } else {
            // Event without load (maintenance, blocked, etc.)
            const { data: geofence } = await supabase
              .from("geofence_zones")
              .select("name")
              .eq("id", event.geofence_zone_id)
              .single();

            const { data: vehicle } = await supabase
              .from("wialon_vehicles")
              .select("fleet_number")
              .eq("id", event.vehicle_id)
              .single();

            if (geofence && vehicle) {
              const geofenceData = geofence as GeofenceZone;
              const vehicleData = vehicle as Vehicle;
              const icon = event.event_type === "entered" ? "📍" : "🚀";
              const action = event.event_type === "entered" ? "entered" : "exited";

              toast({
                title: `${icon} ${vehicleData.fleet_number}`,
                description: `${action} ${geofenceData.name}`,
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("🔔 Geofence notifications subscription status:", status);
      });

    return () => {
      console.log("🔔 Cleaning up geofence notifications subscription");
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - toast is stable and doesn't need to be in deps
};