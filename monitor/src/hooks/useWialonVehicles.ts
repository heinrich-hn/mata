import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch Wialon vehicles for trip assignment
 * Trips table references wialon_vehicles.id via foreign key
 *
 * Vehicles with negative wialon_unit_id values are fleet vehicles
 * without GPS tracking but included for trip/diesel record consistency.
 */
export const useWialonVehicles = () => {
  return useQuery({
    queryKey: ["wialon-vehicles"],
    queryFn: async () => {
      const { data: vehicles, error } = await supabase
        .from("wialon_vehicles")
        .select("*")
        .order("fleet_number", { nullsFirst: false });

      if (error) throw error;

      // Normalize vehicles: ensure fleet_number is populated from name if missing
      const normalizedVehicles = (vehicles || []).map((vehicle) => {
        // Create a copy with effective fleet number
        let effectiveFleetNumber = vehicle.fleet_number;

        // If fleet_number is null, try to extract it from the name
        if (!effectiveFleetNumber && vehicle.name) {
          const nameParts = vehicle.name.split(' - ');
          if (nameParts.length > 0) {
            const possibleFleetNumber = nameParts[0].trim();
            // SIMPLIFIED: Check if it starts with a number (like 21H, 31H) OR is just letters (like UD)
            // This will match "21H", "31H", "26H", "14L", "UD", etc.
            if (/^[\d]+[A-Z]+$|^[A-Z]+$/.test(possibleFleetNumber)) {
              effectiveFleetNumber = possibleFleetNumber;
            }
          }
        }

        // Extract registration from name if not present
        let registration = vehicle.registration;
        if (!registration && vehicle.name) {
          const nameMatch = vehicle.name.match(/-\s*([A-Z0-9\s]+)(?:\s*\(|$)/);
          if (nameMatch) {
            registration = nameMatch[1].trim();
          }
        }

        return {
          ...vehicle,
          fleet_number: effectiveFleetNumber || vehicle.fleet_number,
          registration: registration || vehicle.registration,
        };
      });

      // Sort by fleet number naturally (e.g., 4H, 6H, 14L, 15L, 21H, 22H, 31H, 34H, UD, BVTR 25)
      const sorted = normalizedVehicles.sort((a, b) => {
        const aFleet = a.fleet_number || a.name?.split(' - ')[0] || '';
        const bFleet = b.fleet_number || b.name?.split(' - ')[0] || '';

        // Check if either is non-numeric (like "UD" or "BVTR 25")
        const aIsNumeric = /^\d/.test(aFleet);
        const bIsNumeric = /^\d/.test(bFleet);

        // Put numeric fleet numbers first
        if (aIsNumeric && !bIsNumeric) return -1;
        if (!aIsNumeric && bIsNumeric) return 1;

        // If both are numeric, sort naturally by number
        if (aIsNumeric && bIsNumeric) {
          const aNum = parseInt(aFleet.match(/\d+/)?.[0] || '999');
          const bNum = parseInt(bFleet.match(/\d+/)?.[0] || '999');

          if (aNum !== bNum) return aNum - bNum;

          // If same number, sort by suffix (H vs L)
          const aSuffix = aFleet.replace(/\d+/g, '');
          const bSuffix = bFleet.replace(/\d+/g, '');
          return aSuffix.localeCompare(bSuffix);
        }

        // Both non-numeric, sort alphabetically
        return aFleet.localeCompare(bFleet);
      });

      return sorted;
    },
  });
};