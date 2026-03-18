import { extractFleetNumber } from "@/constants/fleetTyreConfig";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to dynamically fetch all unique fleet numbers from the database.
 * This ensures new fleets are automatically available in all selection dropdowns
 * without needing to update hardcoded constants.
 *
 * Fleet numbers are extracted from vehicle registration_number (e.g., "33H JFK963FS" -> "33H")
 * and also includes the fleet_number column if set.
 */
export function useFleetNumbers() {
  return useQuery({
    queryKey: ["fleet_numbers"],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("fleet_number, registration_number")
        .order("fleet_number");

      if (error) throw error;

      // Extract unique fleet numbers from both fleet_number column and registration_number
      const fleetNumbersSet = new Set<string>();

      vehicles?.forEach((vehicle) => {
        // From fleet_number column
        if (vehicle.fleet_number) {
          fleetNumbersSet.add(vehicle.fleet_number);
        }
        // From registration_number pattern (e.g., "33H JFK963FS" -> "33H")
        if (vehicle.registration_number) {
          const extracted = extractFleetNumber(vehicle.registration_number);
          if (extracted) {
            fleetNumbersSet.add(extracted);
          }
        }
      });

      // Sort fleet numbers: numeric prefix first, then alphabetically
      const sortedFleetNumbers = Array.from(fleetNumbersSet).sort((a, b) => {
        const numA = parseInt(a.match(/^\d+/)?.[0] || "0", 10);
        const numB = parseInt(b.match(/^\d+/)?.[0] || "0", 10);
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });

      return sortedFleetNumbers;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Get fleet numbers as options array for Select components
 */
export function useFleetNumberOptions() {
  const { data: fleetNumbers = [], isLoading, error } = useFleetNumbers();

  const options = fleetNumbers.map((num) => ({ label: num, value: num }));

  return { options, isLoading, error, fleetNumbers };
}