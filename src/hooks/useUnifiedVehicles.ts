// src/hooks/useUnifiedVehicles.ts
// Unified vehicle hook that consolidates the vehicles table with Wialon GPS enrichment
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface UnifiedVehicle {
  // Core vehicle data (from vehicles table)
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  tonnage: number | null;
  engine_specs: string | null;
  active: boolean | null;
  created_at: string | null;

  // Wialon enrichment (from wialon_vehicles via wialon_id)
  wialon_id: number | null;
  wialon_unit_id: number | null;
  wialon_name: string | null;
  has_gps_tracking: boolean;

  // Live GPS data (optional, from delivery_tracking or direct API)
  last_known_position?: {
    latitude: number | null;
    longitude: number | null;
    speed: number | null;
    last_updated: string | null;
  } | null;
}

interface WialonVehicle {
  wialon_unit_id: number;
  name: string;
  fleet_number: string | null;
  registration: string | null;
}

interface UseUnifiedVehiclesOptions {
  /** Include live GPS position data */
  includeGpsData?: boolean;
  /** Filter by active status */
  activeOnly?: boolean;
  /** Search term for filtering */
  searchTerm?: string;
  /** Filter by vehicle type */
  vehicleType?: string;
}

/**
 * Hook that provides a unified view of vehicles with Wialon GPS enrichment.
 *
 * The vehicles table is the single source of truth for fleet data.
 * Wialon integration provides GPS tracking capabilities via the wialon_id foreign key.
 *
 * Data flow:
 * 1. vehicles table → Primary vehicle data (fleet_number, registration, make, model, etc.)
 * 2. vehicles.wialon_id → Links to wialon_vehicles.wialon_unit_id for GPS tracking
 * 3. wialon_vehicles → Provides GPS unit details and tracking capabilities
 *
 * To ensure vehicles are linked to Wialon:
 * - Run SYNC_VEHICLE_MAPPING.sql to auto-map vehicles by fleet_number or registration
 * - Or manually set vehicles.wialon_id when creating/editing vehicles
 */
export const useUnifiedVehicles = (options: UseUnifiedVehiclesOptions = {}) => {
  const {
    includeGpsData = false,
    activeOnly = false,
    searchTerm = "",
    vehicleType
  } = options;

  return useQuery({
    queryKey: ["unified-vehicles", { includeGpsData, activeOnly, searchTerm, vehicleType }],
    queryFn: async (): Promise<UnifiedVehicle[]> => {
      // Build the base query for vehicles
      let query = supabase
        .from("vehicles")
        .select("*")
        .order("fleet_number", { ascending: true });

      // Apply filters
      if (activeOnly) {
        query = query.eq("active", true);
      }

      if (searchTerm) {
        query = query.or(
          `fleet_number.ilike.%${searchTerm}%,registration_number.ilike.%${searchTerm}%,make.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`
        );
      }

      if (vehicleType) {
        query = query.eq("vehicle_type", vehicleType as "truck" | "trailer" | "van" | "bus" | "rigid_truck" | "horse_truck" | "refrigerated_truck" | "reefer" | "interlink");
      }

      const { data: vehicles, error: vehiclesError } = await query;
      if (vehiclesError) throw vehiclesError;

      if (!vehicles || vehicles.length === 0) {
        return [];
      }

      // Get all wialon_ids that are set
      const wialonIds = vehicles
        .filter(v => v.wialon_id !== null)
        .map(v => v.wialon_id as number);

      // Fetch matching Wialon vehicles for enrichment
      const wialonVehiclesMap = new Map<number, WialonVehicle>();

      if (wialonIds.length > 0) {
        const { data: wialonVehicles, error: wialonError } = await supabase
          .from("wialon_vehicles")
          .select("wialon_unit_id, name, fleet_number, registration")
          .in("wialon_unit_id", wialonIds);

        if (!wialonError && wialonVehicles) {
          wialonVehicles.forEach((wv) => {
            wialonVehiclesMap.set(wv.wialon_unit_id, wv);
          });
        }
      }

      // Map vehicles to unified format
      const unifiedVehicles: UnifiedVehicle[] = vehicles.map((vehicle) => {
        const wialonData = vehicle.wialon_id
          ? wialonVehiclesMap.get(vehicle.wialon_id)
          : null;

        return {
          // Core vehicle data
          id: vehicle.id,
          fleet_number: vehicle.fleet_number,
          registration_number: vehicle.registration_number,
          make: vehicle.make,
          model: vehicle.model,
          vehicle_type: vehicle.vehicle_type,
          tonnage: vehicle.tonnage,
          engine_specs: vehicle.engine_specs,
          active: vehicle.active,
          created_at: vehicle.created_at,

          // Wialon enrichment
          wialon_id: vehicle.wialon_id,
          wialon_unit_id: wialonData?.wialon_unit_id ?? null,
          wialon_name: wialonData?.name ?? null,
          has_gps_tracking: !!wialonData,

          // GPS data placeholder (would need live API integration)
          last_known_position: null,
        };
      });

      return unifiedVehicles;
    },
    staleTime: 30000, // 30 seconds
  });
};

/**
 * Hook to get a single unified vehicle by ID
 */
export const useUnifiedVehicle = (vehicleId: string | null) => {
  return useQuery({
    queryKey: ["unified-vehicle", vehicleId],
    queryFn: async (): Promise<UnifiedVehicle | null> => {
      if (!vehicleId) return null;

      const { data: vehicle, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", vehicleId)
        .single();

      if (error) throw error;
      if (!vehicle) return null;

      // Get Wialon data if linked
      let wialonData = null;
      if (vehicle.wialon_id) {
        const { data } = await supabase
          .from("wialon_vehicles")
          .select("wialon_unit_id, name, fleet_number, registration")
          .eq("wialon_unit_id", vehicle.wialon_id)
          .single();
        wialonData = data;
      }

      return {
        id: vehicle.id,
        fleet_number: vehicle.fleet_number,
        registration_number: vehicle.registration_number,
        make: vehicle.make,
        model: vehicle.model,
        vehicle_type: vehicle.vehicle_type,
        tonnage: vehicle.tonnage,
        engine_specs: vehicle.engine_specs,
        active: vehicle.active,
        created_at: vehicle.created_at,
        wialon_id: vehicle.wialon_id,
        wialon_unit_id: wialonData?.wialon_unit_id ?? null,
        wialon_name: wialonData?.name ?? null,
        has_gps_tracking: !!wialonData,
        last_known_position: null,
      };
    },
    enabled: !!vehicleId,
  });
};

/**
 * Hook to get vehicles for dropdown/select components
 * Returns a simplified list optimized for selection UI
 */
export const useVehicleSelect = (activeOnly = true) => {
  return useQuery({
    queryKey: ["vehicle-select", activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number, make, model, vehicle_type, wialon_id")
        .order("fleet_number", { ascending: true });

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((v) => ({
        id: v.id,
        label: v.fleet_number
          ? `${v.fleet_number} - ${v.registration_number}`
          : v.registration_number,
        fleet_number: v.fleet_number,
        registration_number: v.registration_number,
        make: v.make,
        model: v.model,
        vehicle_type: v.vehicle_type,
        has_gps_tracking: v.wialon_id !== null,
      }));
    },
    staleTime: 60000, // 1 minute
  });
};

export default useUnifiedVehicles;