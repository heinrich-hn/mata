/**
 * Fleet subcategory detection based on fleet number letter suffix.
 *
 * Suffix mapping:
 *   F  → REEFERS   (e.g. 4F, 7F)
 *   T  → INTERLINKS
 *   H  → TRUCKS
 *   L  → LMV
 *   (none / unknown) → UNASSIGNED
 */

export type FleetSubcategory = "REEFERS" | "INTERLINKS" | "TRUCKS" | "LMV" | "UNASSIGNED";

/**
 * Returns true when the fleet number belongs to the REEFERS subcategory.
 * REEFER fleet numbers end with the letter 'F' (case-insensitive).
 */
export function isReeferFleet(fleetNumber: string | null | undefined): boolean {
  if (!fleetNumber) return false;
  return /F$/i.test(fleetNumber.trim());
}

/**
 * Extracts the letter suffix from a fleet number.
 * e.g. "4F" → "F", "21T" → "T", "3L" → "L"
 */
export function getFleetSuffix(fleetNumber: string | null | undefined): string | null {
  if (!fleetNumber) return null;
  const match = fleetNumber.trim().match(/[A-Za-z]+$/);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Categorises a fleet number into one of the defined subcategories
 * based on the trailing letter suffix.
 */
export function getFleetSubcategory(fleetNumber: string | null | undefined): FleetSubcategory {
  const suffix = getFleetSuffix(fleetNumber);
  switch (suffix) {
    case "F": return "REEFERS";
    case "T": return "INTERLINKS";
    case "H": return "TRUCKS";
    case "L": return "LMV";
    default: return "UNASSIGNED";
  }
}

/** Display metadata for each subcategory. */
export const FLEET_SUBCATEGORY_META: Record<FleetSubcategory, { label: string; suffix: string | null; color: string; emoji: string; order: number }> = {
  REEFERS: { label: "REEFERS", suffix: "F", color: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-400", emoji: "❄️", order: 1 },
  INTERLINKS: { label: "INTERLINKS", suffix: "T", color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-400", emoji: "🔗", order: 2 },
  LMV: { label: "LMV", suffix: "L", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400", emoji: "🚗", order: 3 },
  TRUCKS: { label: "TRUCKS", suffix: "H", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400", emoji: "🚛", order: 4 },
  UNASSIGNED: { label: "UNASSIGNED", suffix: null, color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400", emoji: "❓", order: 5 },
};
