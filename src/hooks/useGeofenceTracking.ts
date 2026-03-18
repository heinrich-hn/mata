import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWialonContext } from "@/integrations/wialon/useWialonContext";
import { useEffect } from "react";

interface ActiveLoad {
  id: string;
  load_number: string;
  assigned_vehicle_id: string;
  status: string;
}

/**
 * Hook to monitor vehicle locations and trigger geofence checks
 * Automatically detects when vehicles enter/exit geofenced zones
 */
export const useGeofenceTracking = () => {
  const { vehicleLocations, isConnected } = useWialonContext();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected || vehicleLocations.length === 0) return;

    const checkGeofences = async () => {
      try {
        // Get all active loads with assigned vehicles
        const { data: activeLoads, error: loadsError } = await supabase
          .from("loads")
          .select("id, load_number, assigned_vehicle_id, status")
          .in("status", ["assigned", "in_transit", "arrived_at_loading_point"])
          .not("assigned_vehicle_id", "is", null);

        if (loadsError) throw loadsError;

        if (!activeLoads || activeLoads.length === 0) {
          console.log("No active loads to track");
          return;
        }

        // For each active load, check if vehicle is in any geofence
        for (const load of activeLoads as ActiveLoad[]) {
          const vehicle = vehicleLocations.find(
            (v) => v.vehicleId === load.assigned_vehicle_id
          );

          if (!vehicle) {
            console.log(`Vehicle ID ${load.assigned_vehicle_id} could not be located in Wialon system. Available vehicles:`,
              vehicleLocations.map(v => ({ id: v.vehicleId, name: v.vehicleName }))
            );
            continue;
          }

          // Call database function to check geofence entry
          // This function checks all active geofences and creates events if needed
          const { error: geoError } = await supabase.rpc(
            "check_geofence_entry",
            {
              p_vehicle_id: load.assigned_vehicle_id,
              p_latitude: vehicle.latitude,
              p_longitude: vehicle.longitude,
            }
          );

          if (geoError) {
            console.error("Geofence check error:", geoError);
            continue;
          }
        }
      } catch (error) {
        console.error("Geofence tracking error:", error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkGeofences, 30000);

    // Initial check after 5 seconds
    const initialCheck = setTimeout(checkGeofences, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialCheck);
    };
  }, [isConnected, vehicleLocations, toast]);
};