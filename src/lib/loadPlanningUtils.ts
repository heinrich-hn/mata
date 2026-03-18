/**
 * Load Planning Utilities
 * Helper functions for processing distribution schedules and bulk imports.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  BulkImportMapping,
  BulkImportResult,
  DistributionScheduleEntry,
  LoadTemplate
} from '@/types/loadPlanning';
import { DESTINATION_LOCATIONS, FARM_LOCATIONS } from '@/types/loadPlanning';

/**
 * Parse CSV content into distribution schedule entries.
 * @param {string} csvContent - The raw CSV content as a string.
 * @param {BulkImportMapping} mapping - The mapping of CSV columns to entry fields.
 * @returns {DistributionScheduleEntry[]} - Array of parsed distribution schedule entries.
 */
export const parseDistributionCSV = (
  csvContent: string,
  mapping: BulkImportMapping
): DistributionScheduleEntry[] => {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const entries: DistributionScheduleEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    entries.push({
      dispatchDate: row[mapping.dispatchDateColumn],
      arrivalDate: row[mapping.arrivalDateColumn],
      farm: row[mapping.farmColumn],
      destination: row[mapping.destinationColumn],
      channel: row[mapping.channelColumn]?.toLowerCase() || 'direct',
      packaging: row[mapping.packagingColumn]?.toLowerCase() || 'crates',
      palletCount: mapping.palletsColumn ? parseInt(row[mapping.palletsColumn], 10) : 0,
      notes: mapping.notesColumn ? row[mapping.notesColumn] : undefined,
      contactPerson: mapping.contactPersonColumn ? row[mapping.contactPersonColumn] : undefined,
      contactPhone: mapping.contactPhoneColumn ? row[mapping.contactPhoneColumn] : undefined,
      weightKg: mapping.weightKgColumn ? parseFloat(row[mapping.weightKgColumn]) : undefined,
      volumeM3: mapping.volumeM3Column ? parseFloat(row[mapping.volumeM3Column]) : undefined,
      quotedPrice: mapping.quotedPriceColumn ? parseFloat(row[mapping.quotedPriceColumn]) : undefined,
      customerName: mapping.customerNameColumn ? row[mapping.customerNameColumn] : undefined,
    });
  }

  return entries;
};

/**
 * Parse date string from various formats to ISO date
 * Handles formats like: "Monday, 10-Nov-25", "2025-11-10", "11/10/2025"
 */
const parseFlexibleDate = (dateStr: string): Date => {
  // Remove day of week if present (e.g., "Monday, ")
  const cleanDate = dateStr.replace(/^[A-Za-z]+,?\s*/, '').trim();

  // Try parsing directly first
  let date = new Date(cleanDate);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try format: "10-Nov-25" or "10-Nov-2025"
  const match = cleanDate.match(/(\d{1,2})-([A-Za-z]+)-(\d{2,4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    let year = parseInt(match[3], 10);

    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year += 2000;
    }

    // Month name to number mapping
    const months: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const month = months[monthStr.toLowerCase().substring(0, 3)];
    if (month !== undefined) {
      date = new Date(year, month, day, 6, 0, 0); // Default to 6 AM
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Fallback: return current date to avoid invalid date
  console.warn(`Could not parse date: "${dateStr}", using current date`);
  return new Date();
};

/**
 * Convert a distribution schedule entry to a load object.
 * @param {DistributionScheduleEntry} entry - The distribution schedule entry.
 * @param {string} loadNumber - The generated load number.
 * @returns {object} - The load object.
 */
export const convertScheduleEntryToLoad = (
  entry: DistributionScheduleEntry,
  loadNumber: string
) => {
  const farm = FARM_LOCATIONS[entry.farm as keyof typeof FARM_LOCATIONS] || {
    name: entry.farm,
    address: entry.farm,
    lat: 0,
    lng: 0,
  };

  const destination = DESTINATION_LOCATIONS[entry.destination as keyof typeof DESTINATION_LOCATIONS] || {
    name: entry.destination,
    address: entry.destination,
    lat: 0,
    lng: 0,
  };

  // Parse dates using flexible parser
  const dispatchDate = parseFlexibleDate(entry.dispatchDate);
  dispatchDate.setHours(6, 0, 0, 0); // Set to 6 AM
  const dispatchEnd = new Date(dispatchDate);
  dispatchEnd.setHours(18, 0, 0, 0); // Set to 6 PM

  const arrivalDate = parseFlexibleDate(entry.arrivalDate);
  arrivalDate.setHours(6, 0, 0, 0); // Set to 6 AM
  const arrivalEnd = new Date(arrivalDate);
  arrivalEnd.setHours(18, 0, 0, 0); // Set to 6 PM

  // Calculate expected departure from pickup (2 hours after arrival for loading)
  const expectedDepartureFromPickup = new Date(dispatchDate);
  expectedDepartureFromPickup.setHours(dispatchDate.getHours() + 2);

  // Calculate expected departure from delivery (2 hours after arrival for offloading)
  const expectedDepartureFromDelivery = new Date(arrivalDate);
  expectedDepartureFromDelivery.setHours(arrivalDate.getHours() + 2);

  return {
    load_number: loadNumber,
    customer_name: entry.customerName || destination.name, // Use provided customer or destination as customer (the recipient)
    contact_person: entry.contactPerson || null,
    contact_phone: entry.contactPhone || null,
    origin: farm.address,
    origin_lat: farm.lat,
    origin_lng: farm.lng,
    origin_address: farm.address,
    destination: destination.address,
    destination_address: destination.address,
    destination_lat: destination.lat,
    destination_lng: destination.lng,
    pickup_datetime: dispatchDate.toISOString(),
    pickup_window_start: dispatchDate.toISOString(),
    pickup_window_end: dispatchEnd.toISOString(),
    // Expected timing fields for loading phase
    expected_arrival_at_pickup: dispatchDate.toISOString(),
    expected_departure_from_pickup: expectedDepartureFromPickup.toISOString(),
    delivery_datetime: arrivalDate.toISOString(),
    delivery_window_start: arrivalDate.toISOString(),
    delivery_window_end: arrivalEnd.toISOString(),
    // Expected timing fields for delivery phase
    expected_arrival_at_delivery: arrivalDate.toISOString(),
    expected_departure_from_delivery: expectedDepartureFromDelivery.toISOString(),
    cargo_type: `${entry.channel} - ${entry.packaging}`,
    special_instructions: entry.notes || `${entry.channel} distribution`,
    special_requirements: [
      entry.packaging,
      entry.palletCount && entry.palletCount > 0 ? `${entry.palletCount} pallets` : null,
    ].filter(Boolean) as string[],
    weight_kg: entry.weightKg || (entry.palletCount && entry.palletCount > 0 ? entry.palletCount * 1200 : 1000), // Use provided weight or calculate from pallets, default 1000kg
    volume_m3: entry.volumeM3 || null,
    status: 'pending' as const,
    priority: 'medium' as const,
    currency: 'ZAR' as const, // Changed to ZAR to match manual entry default
    quoted_price: entry.quotedPrice || null,
  };
};

/**
 * Generate load number (format: LD-YYYYMMDD-XXX).
 * @param {string} date - The date to generate the load number for.
 * @returns {Promise<string>} - The generated load number.
 */
export const generateLoadNumber = async (date: string): Promise<string> => {
  const dateStr = date.replace(/-/g, '');
  const prefix = `LD-${dateStr}`;

  // Query existing loads for this date
  const { data, error } = await supabase
    .from('loads')
    .select('load_number')
    .like('load_number', `${prefix}%`)
    .order('load_number', { ascending: false })
    .limit(1);

  if (error) {
    // Log the error for debugging purposes
    console.error("Failed to fetch existing loads:", error);
    return `${prefix}-001`;
  }

  if (!data || data.length === 0) {
    return `${prefix}-001`;
  }

  // Extract sequence number and increment.
  const lastNumber = data[0].load_number;
  const lastSeq = parseInt(lastNumber.split('-')[2]) || 0;
  const newSeq = (lastSeq + 1).toString().padStart(3, '0');

  return `${prefix}-${newSeq}`;
};

/**
 * Bulk create loads from the distribution schedule.
 * @param {DistributionScheduleEntry[]} entries - The distribution schedule entries to create loads from.
 * @returns {Promise<BulkImportResult>} - The result of the bulk creation process.
 */
export const bulkCreateLoads = async (
  entries: DistributionScheduleEntry[]
): Promise<BulkImportResult> => {
  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    createdLoads: [],
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      // Validate required fields.
      if (!entry.dispatchDate || !entry.arrivalDate || !entry.farm || !entry.destination) {
        result.failed++;
        result.errors.push({
          row: i + 2, // +2 because row 1 is header and array is 0-indexed.
          field: 'required',
          error: 'Missing required fields (dispatch date, arrival date, farm, or destination)',
        });
        continue;
      }

      // Generate load number.
      const loadNumber = await generateLoadNumber(entry.dispatchDate);

      // Convert to load object.
      const loadData = convertScheduleEntryToLoad(entry, loadNumber);

      // Insert into database.
      const { data, error } = await supabase
        .from('loads')
        .insert([loadData])
        .select('id')
        .single();

      if (error) throw error;

      result.success++;
      result.createdLoads.push(data?.id); // Use optional chaining.
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: i + 2,
        field: 'database',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
};

/**
 * Create load template from route.
 * @param {Omit<LoadTemplate, 'id' | 'createdAt' | 'usageCount'>} template - The template data to create a saved route.
 * @returns {Promise<any>} - The created template object.
 */
export const createLoadTemplate = async (template: Omit<LoadTemplate, 'id' | 'createdAt' | 'usageCount'>) => {
  const { data, error } = await supabase
    .from('saved_routes')
    .insert([{
      name: template.name,
      description: template.description,
      waypoints: [
        {
          address: template.origin,
          lat: template.originLat,
          lng: template.originLng,
          type: 'pickup',
        },
        {
          address: template.destination,
          lat: template.destinationLat,
          lng: template.destinationLng,
          type: 'delivery',
        },
      ],
      total_distance_km: template.estimatedDistanceKm,
      estimated_duration_mins: template.estimatedDurationHours * 60,
      is_template: true,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get route suggestions based on frequency.
 * @returns {Promise<any[]>} - Array of route suggestions with frequency and last used dates.
 */
export const getRouteSuggestions = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('loads')
    .select('origin, destination_address, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group by route and count frequency.
  const routeFrequency: Record<string, number> = {};
  const routeLastUsed: Record<string, string> = {};

  data?.forEach(load => {
    const routeKey = `${load.origin}→${load.destination_address}`;
    routeFrequency[routeKey] = (routeFrequency[routeKey] || 0) + 1;
    if (!routeLastUsed[routeKey] || load.created_at > routeLastUsed[routeKey]) {
      routeLastUsed[routeKey] = load.created_at;
    }
  });

  // Convert to suggestions.
  return Object.entries(routeFrequency)
    .map(([route, frequency]) => {
      const [farm, destination] = route.split('→');
      return {
        farm,
        destination,
        frequency,
        lastUsed: routeLastUsed[route],
        suggestedTemplate: frequency >= 3, // Suggest template if used 3+ times in 30 days.
      };
    })
    .sort((a, b) => b.frequency - a.frequency);
};

/**
 * Generate sample CSV template.
 * @returns {string} - A sample CSV string for load planning.
 */
export const generateSampleCSV = (): string => {
  const headers = 'dispatch_date,arrival_date,farm,destination,channel,packaging,pallets,notes,customer_name,contact_person,contact_phone,weight_kg,volume_m3,quoted_price';
  const samples = [
    '2025-11-11,2025-11-12,BV,Harare,Retail,Crates,20,Vansales/Retail,Harare Central Market,John Doe,+263 71 234 5678,24000,15.5,5500',
    '2025-11-10,2025-11-11,CBC,Harare,Vendor,Bins,15,,Vendor Corp,Jane Smith,+263 71 987 6543,18000,12.0,4200',
    '2025-11-10,2025-11-11,CBC,Bulawayo,Vendor,Bins,20,Vansales/Vendor,,,,,',
    '2025-11-12,2025-11-12,BV,Mutare,Retail,Crates,0,Retail/Vendor,,,,,',
    '2025-11-10,2025-11-12,CBC,Freshmark Polokwane,Direct,Crates,0,,Freshmark,Mike Johnson,+27 11 234 5678,1000,,3500',
  ];

  return [headers, ...samples].join('\\n');
};
