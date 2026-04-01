import { extractRegistrationNumber, getFleetConfig } from "@/constants/fleetTyreConfig";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Extended tyre details fetched from the tyres and tyre_inventory tables
 */
export interface TyreDetails {
  id: string;
  brand: string;
  model: string;
  size: string;
  type: string;
  serial_number: string | null;
  dot_code: string | null;
  initial_tread_depth: number | null;
  current_tread_depth: number | null;
  condition: string | null;
  installation_date: string | null;
  installation_km: number | null;
  km_travelled: number | null;
  purchase_cost_zar: number | null;
  notes: string | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  km_at_last_inspection: number | null;
}

export interface FleetTyreData {
  id: string;
  fleet_number: string;
  position: string;
  registration_no: string;
  tyre_code: string | null;
  updated_at: string;
  vehicle_id?: string | null;
  /** Extended tyre details including DOT code */
  tyre_details?: TyreDetails | null;
}

interface UseFleetTyrePositionsParams {
  vehicleRegistration: string | undefined;
  fleetNumber?: string | null;
}

/**
 * Fetch fleet-specific tyre positions from the unified fleet_tyre_positions table
 * Also fetches extended tyre details including DOT code from tyres and tyre_inventory tables.
 *
 * @param params.vehicleRegistration - The full vehicle registration number
 * @param params.fleetNumber - Optional fleet number from vehicles table. If provided, uses this directly instead of extracting from registration.
 */
export function useFleetTyrePositions({ vehicleRegistration, fleetNumber: providedFleetNumber }: UseFleetTyrePositionsParams) {
  return useQuery({
    queryKey: ["fleet_tyre_positions", vehicleRegistration, providedFleetNumber],
    queryFn: async () => {
      if (!vehicleRegistration) {
        return [];
      }

      // Use provided fleetNumber from vehicles table, or fall back to config-based extraction
      const fleetNumber = providedFleetNumber || undefined;
      const fleetConfig = fleetNumber ? getFleetConfig(fleetNumber) : null;

      if (!fleetConfig || !fleetNumber) {
        console.warn(`No fleet configuration found for fleet number: ${fleetNumber || 'undefined'}`);
        return [];
      }

      const registrationNo = extractRegistrationNumber(vehicleRegistration);

      // Query the unified fleet_tyre_positions table with fleet_number filter
      const { data, error } = await supabase
        .from("fleet_tyre_positions")
        .select("*")
        .eq("fleet_number", fleetNumber)
        .eq("registration_no", registrationNo)
        .order("position");

      if (error) {
        console.error(`Error fetching fleet tyre positions for ${fleetNumber}:`, error);
        throw error;
      }

      // Get all tyre codes that have valid UUIDs (non-null, non-empty, not NEW_CODE_ prefix)
      const tyreCodes = (data || [])
        .map((fp: { tyre_code: string | null }) => fp.tyre_code)
        .filter((code: string | null): code is string =>
          code !== null &&
          code.trim() !== '' &&
          !code.startsWith('NEW_CODE_')
        );

      // Fetch tyre details for all positions that have valid tyre codes
      const tyreDetailsMap: Map<string, TyreDetails> = new Map();

      if (tyreCodes.length > 0) {
        // Fetch tyre records with their inventory details
        const { data: tyresData, error: tyresError } = await supabase
          .from("tyres")
          .select(`
            id,
            brand,
            model,
            size,
            type,
            serial_number,
            dot_code,
            initial_tread_depth,
            current_tread_depth,
            condition,
            installation_date,
            installation_km,
            km_travelled,
            purchase_cost_zar,
            notes,
            inventory_id,
            last_inspection_date
          `)
          .in("id", tyreCodes);

        if (tyresError) {
          console.error(`Error fetching tyre details:`, tyresError);
          // Continue without tyre details rather than failing completely
        } else if (tyresData) {
          // Get inventory IDs to fetch DOT codes
          const inventoryIds = tyresData
            .map(t => t.inventory_id)
            .filter((id): id is string => id !== null);

          // Fetch DOT codes from tyre_inventory
          const dotCodeMap: Map<string, string | null> = new Map();
          if (inventoryIds.length > 0) {
            const { data: inventoryData, error: inventoryError } = await supabase
              .from("tyre_inventory")
              .select("id, dot_code")
              .in("id", inventoryIds);

            if (!inventoryError && inventoryData) {
              inventoryData.forEach(inv => {
                dotCodeMap.set(inv.id, inv.dot_code);
              });
            }
          }

          // Build the tyre details map
          tyresData.forEach(tyre => {
            // Use dot_code from tyre directly, fallback to inventory lookup
            const dotCodeFromInventory = tyre.inventory_id ? dotCodeMap.get(tyre.inventory_id) || null : null;
            const dotCode = tyre.dot_code || dotCodeFromInventory;

            tyreDetailsMap.set(tyre.id, {
              id: tyre.id,
              brand: tyre.brand,
              model: tyre.model,
              size: tyre.size,
              type: tyre.type,
              serial_number: tyre.serial_number,
              dot_code: dotCode,
              initial_tread_depth: tyre.initial_tread_depth,
              current_tread_depth: tyre.current_tread_depth,
              condition: tyre.condition,
              installation_date: tyre.installation_date,
              installation_km: tyre.installation_km,
              km_travelled: tyre.km_travelled,
              purchase_cost_zar: tyre.purchase_cost_zar,
              notes: tyre.notes,
              last_inspection_date: tyre.last_inspection_date,
              next_inspection_date: null, // Not stored in tyres table
              km_at_last_inspection: null,
            });
          });
        }
      }

      // Combine fleet positions with tyre details
      const enrichedData: FleetTyreData[] = (data || []).map((fp: FleetTyreData) => ({
        ...fp,
        tyre_details: fp.tyre_code ? tyreDetailsMap.get(fp.tyre_code) || null : null,
      }));

      return enrichedData;
    },
    enabled: !!vehicleRegistration && !!providedFleetNumber,
  });
}

/**
 * Update a specific tyre position in the unified fleet_tyre_positions table
 *
 * @param fleetNumber - The fleet number from the vehicles table
 * @param vehicleRegistration - The full vehicle registration number
 * @param position - The tyre position (e.g., "V1", "A1L")
 * @param tyreCode - The tyre code to assign to this position
 */
export async function updateFleetTyrePosition(
  fleetNumber: string,
  vehicleRegistration: string,
  position: string,
  tyreCode: string
) {
  const fleetConfig = getFleetConfig(fleetNumber);

  if (!fleetConfig) {
    throw new Error(`No fleet configuration found for fleet number: ${fleetNumber}`);
  }

  const registrationNo = extractRegistrationNumber(vehicleRegistration);

  const { error } = await supabase
    .from("fleet_tyre_positions")
    .update({
      tyre_code: tyreCode,
      updated_at: new Date().toISOString()
    })
    .eq("fleet_number", fleetNumber)
    .eq("registration_no", registrationNo)
    .eq("position", position);

  if (error) {
    console.error(`Error updating fleet_tyre_positions for ${fleetNumber}:`, error);
    throw error;
  }
}