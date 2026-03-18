/**
 * Fleet utility functions for extracting and formatting fleet numbers
 */

/**
 * Extract the short fleet number code from a vehicle name or fleet string.
 *
 * Examples:
 * - "34H - (MR86PVGP)" → "34H"
 * - "UD QUESTER 33H" → "33H"
 * - "4H" → "4H"
 * - "Fleet 21H - Truck" → "21H"
 * - "UD" → "UD"
 *
 * @param fleetString - The full vehicle name or fleet number string
 * @returns The extracted short fleet code (e.g., "33H", "24H", "UD")
 */
export function extractFleetNumber(fleetString: string | null | undefined): string {
  if (!fleetString) return '';

  const trimmed = fleetString.trim();

  // Pattern 1: Match common fleet number formats like "33H", "4H", "21H"
  // These are typically a number followed by "H" (for Horse/truck)
  const fleetPattern = /\b(\d{1,3}H)\b/i;
  const match = trimmed.match(fleetPattern);

  if (match) {
    return match[1].toUpperCase();
  }

  // Pattern 2: Special fleet codes like "UD" that don't follow the number+H format
  // If the string starts with a known fleet code, use it
  const specialCodes = ['UD', 'DEMO'];
  for (const code of specialCodes) {
    if (trimmed.toUpperCase().startsWith(code)) {
      return code;
    }
  }

  // Pattern 3: If it's already a short code (2-4 chars, alphanumeric), return as-is
  if (/^[A-Z0-9]{1,4}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Fallback: Return first word if nothing else matches
  const firstWord = trimmed.split(/[\s\-(]/)[0];
  return firstWord.length <= 6 ? firstWord.toUpperCase() : trimmed;
}

/**
 * Format a fleet number for display - ensures consistent uppercase format
 */
export function formatFleetNumber(fleetNumber: string | null | undefined): string {
  const extracted = extractFleetNumber(fleetNumber);
  return extracted || '-';
}