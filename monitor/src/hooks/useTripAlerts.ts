import { useEffect, useRef, useCallback } from 'react';
import {
  createDuplicatePODAlert,
  createMissingRevenueAlert,
  createFlaggedCostAlert,
  createNoCostsAlert,
} from '@/lib/tripAlerts';
import { resolveAlertsByTrip, resolveDuplicatePODAlerts } from '@/lib/resolveAlerts';
import { supabase } from '@/integrations/supabase/client';
import { TripAlertContext } from '@/types/tripAlerts';

// Define proper types for JSON fields
interface DelayReason {
  reason: string;
  date?: string;
  duration_hours?: number;
  [key: string]: unknown;
}

interface CompletionValidation {
  validated_at?: string;
  validated_by?: string;
  flags_checked?: boolean;
  unresolved_flags?: number;
  [key: string]: unknown;
}

interface EditHistoryEntry {
  edited_at: string;
  edited_by: string;
  changes: Record<string, unknown>;
  [key: string]: unknown;
}

// Define proper types for costs
interface Cost {
  amount: number;
  description?: string;
  is_flagged?: boolean;
  investigation_status?: string;
}

interface AdditionalCost {
  amount: number;
  description?: string;
}

// Export the Trip interface so it can be used by other files
export interface Trip {
  id: string;
  trip_number: string;
  fleet_number?: string;
  driver_name?: string;
  client_name?: string;
  base_revenue?: number;
  revenue_currency?: string;
  payment_status?: string;
  status?: string;
  zero_revenue_comment?: string | null;
  hasFlaggedCosts?: boolean;
  flaggedCostCount?: number;
  hasNoCosts?: boolean;
  daysInProgress?: number;
  costs?: Cost[];
  additional_costs?: AdditionalCost[];
  departure_date?: string;
  validation_notes?: string | null;
  delay_reasons?: DelayReason[] | null;
  completion_validation?: CompletionValidation | null;
  edit_history?: EditHistoryEntry[] | null;
  hasIssues?: boolean;
}

interface UseTripAlertsOptions {
  enabled?: boolean;
  onAlertCreated?: (alertId: string, type: string) => void;
  batchSize?: number;
  delayBetweenBatches?: number;
  updateInterval?: number; // in milliseconds
}

export function useTripAlerts(trips: Trip[], options: UseTripAlertsOptions = {}) {
  const {
    enabled = true,
    onAlertCreated,
    batchSize = 10,
    delayBetweenBatches = 500,
    updateInterval = 3 * 60 * 60 * 1000, // 3 hours default
  } = options;

  const processedAlerts = useRef<Set<string>>(new Set());
  const processingRef = useRef(false);
  const previousTripStates = useRef<Map<string, Trip>>(new Map());
  const previousPODCounts = useRef<Map<string, number>>(new Map());
  const lastUpdateTime = useRef<number>(0);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const initializedRef = useRef(false);

  // Pre-load existing trip alerts from DB to prevent recreating resolved alerts
  const initializeProcessedAlerts = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Helper: chunk an array to avoid Supabase URL length limits on .in() filters
    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };
    const BATCH = 40; // Keep well under URL length limits (~40 UUIDs ≈ 1500 chars)
    const PAGE_SIZE = 1000;

    try {
      // ── Step 1: Paginate to load ALL trip alerts (not just 2000) ──
      let allAlerts: { id: string; source_id: string | null; category: string; metadata: unknown; status: string; created_at: string }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from('alerts')
          .select('id, source_id, category, metadata, status, created_at')
          .eq('source_type', 'trip')
          .in('category', ['duplicate_pod', 'load_exception', 'fuel_anomaly'])
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (!page || page.length === 0) break;
        allAlerts = allAlerts.concat(page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (!allAlerts.length) return;

      // ── Step 2: Deduplicate — keep only the NEWEST alert per (source_id, issue_type) ──
      // Group alerts by their dedup key — MUST match the keys used in createNewAlerts:
      //   missing-revenue-${tripId}, flagged-costs-${tripId}, no-costs-${tripId}, duplicate-pod-${pod}
      const issueTypeToKeyPrefix: Record<string, string> = {
        'missing_revenue': 'missing-revenue',
        'flagged_costs': 'flagged-costs',
        'no_costs': 'no-costs',
        'duplicate_pod': 'duplicate-pod',
        'long_running': 'long-running',
      };

      const alertsByKey = new Map<string, typeof allAlerts>();
      for (const alert of allAlerts) {
        const issueType = (alert.metadata as Record<string, unknown>)?.issue_type as string;
        const podNumber = (alert.metadata as Record<string, unknown>)?.pod_number as string;
        let key: string | null = null;

        if (alert.category === 'duplicate_pod' && podNumber) {
          key = `duplicate-pod-${podNumber}`;
        } else if (issueType && alert.source_id) {
          const prefix = issueTypeToKeyPrefix[issueType] || issueType.replace(/_/g, '-');
          key = `${prefix}-${alert.source_id}`;
        }

        if (key) {
          const existing = alertsByKey.get(key) || [];
          existing.push(alert);
          alertsByKey.set(key, existing);
        }
      }

      // For each key group with >1 alert, resolve all but the newest
      const duplicateIdsToResolve: string[] = [];
      for (const [, group] of alertsByKey) {
        if (group.length > 1) {
          // group is already sorted newest-first (from the query ORDER BY)
          // Keep the first (newest), resolve the rest
          for (let i = 1; i < group.length; i++) {
            if (group[i].status === 'active') {
              duplicateIdsToResolve.push(group[i].id);
            }
          }
        }
      }

      if (duplicateIdsToResolve.length > 0) {
        for (const batch of chunk(duplicateIdsToResolve, BATCH)) {
          await supabase
            .from('alerts')
            .update({
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              resolution_comment: 'Auto-resolved: duplicate alert for same trip',
            })
            .in('id', batch);
        }
        console.log(`Dedup: resolved ${duplicateIdsToResolve.length} duplicate alerts`);
      }

      // ── Step 3: Clean up false-positive no_costs alerts ──
      const activeNoCostAlerts = allAlerts.filter(
        a => (a.metadata as Record<string, unknown>)?.issue_type === 'no_costs'
          && a.status === 'active'
          && !duplicateIdsToResolve.includes(a.id) // skip already-resolved dupes
      );
      const noCostSourceIds = [...new Set(activeNoCostAlerts.map(a => a.source_id).filter((id): id is string => !!id))];

      if (noCostSourceIds.length > 0) {
        // Find trips that are NOT completed (shouldn't have no_costs alerts)
        const nonCompletedIds: string[] = [];
        for (const batch of chunk(noCostSourceIds, BATCH)) {
          const { data: rows } = await supabase
            .from('trips')
            .select('id')
            .in('id', batch)
            .neq('status', 'completed');
          if (rows) nonCompletedIds.push(...rows.map(t => t.id));
        }

        if (nonCompletedIds.length > 0) {
          for (const batch of chunk(nonCompletedIds, BATCH)) {
            await supabase
              .from('alerts')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolution_comment: 'Auto-resolved: trip not yet completed',
              })
              .eq('source_type', 'trip')
              .eq('category', 'fuel_anomaly')
              .eq('status', 'active')
              .filter('metadata->>issue_type', 'eq', 'no_costs')
              .in('source_id', batch);
          }
          console.log(`Auto-resolved ${nonCompletedIds.length} false-positive no_costs alerts for non-completed trips`);
        }

        // Resolve alerts for trips that now have costs
        const tripIdsWithCosts = new Set<string>();
        // Only check trips not already resolved above
        const remainingSourceIds = noCostSourceIds.filter(id => !nonCompletedIds.includes(id));
        for (const batch of chunk(remainingSourceIds, BATCH)) {
          const { data: costRows } = await supabase
            .from('cost_entries')
            .select('trip_id')
            .in('trip_id', batch);
          if (costRows) {
            for (const c of costRows) {
              if (c.trip_id) tripIdsWithCosts.add(c.trip_id);
            }
          }
        }

        if (tripIdsWithCosts.size > 0) {
          const costTripIds = [...tripIdsWithCosts];
          for (const batch of chunk(costTripIds, BATCH)) {
            await supabase
              .from('alerts')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolution_comment: 'Auto-resolved: costs now exist for this trip',
              })
              .eq('source_type', 'trip')
              .eq('category', 'fuel_anomaly')
              .eq('status', 'active')
              .filter('metadata->>issue_type', 'eq', 'no_costs')
              .in('source_id', batch);
          }
          console.log(`Auto-resolved ${costTripIds.length} no_costs alerts for trips that now have costs`);
        }
      }

      // ── Step 4: Seed the processedAlerts cache with ALL unique keys ──
      for (const [key] of alertsByKey) {
        processedAlerts.current.add(key);
      }
      console.log(`Pre-loaded ${processedAlerts.current.size} existing trip alert keys`);
    } catch (error) {
      console.error('Error pre-loading existing alerts:', error);
      // On failure, reset so next mount can try again
      initializedRef.current = false;
    }
  }, []);

  // Resolution check — runs every time trip data changes (NOT throttled)
  // This ensures alerts are resolved promptly when issues are fixed in the main app
  const checkForResolutions = useCallback(async () => {
    if (!enabled || !trips.length || !mountedRef.current) return;
    if (previousTripStates.current.size === 0) return; // No previous data to compare

    const resolvedIssues: Map<string, string[]> = new Map();
    const currentPODCounts: Map<string, number> = new Map();

    for (const trip of trips) {
      const previousTrip = previousTripStates.current.get(trip.id);

      if (previousTrip) {
        const issuesResolved: string[] = [];

        // Check if missing revenue was resolved
        const hadMissingRevenue = (!previousTrip.base_revenue || previousTrip.base_revenue === 0) && !previousTrip.zero_revenue_comment;
        const hasMissingRevenueNow = (!trip.base_revenue || trip.base_revenue === 0) && !trip.zero_revenue_comment;
        if (hadMissingRevenue && !hasMissingRevenueNow) {
          issuesResolved.push('missing-revenue');
        }

        // Check if flagged costs were resolved
        if (previousTrip.hasFlaggedCosts && !trip.hasFlaggedCosts) {
          issuesResolved.push('flagged-costs');
        }

        // Check if no-costs was resolved (cost entries were added)
        if (previousTrip.hasNoCosts && !trip.hasNoCosts) {
          issuesResolved.push('no-costs');
        }

        if (issuesResolved.length > 0) {
          resolvedIssues.set(trip.id, issuesResolved);
        }
      }

      // Update previous state for next comparison
      previousTripStates.current.set(trip.id, { ...trip });

      // Track POD counts
      if (trip.status !== 'completed') {
        currentPODCounts.set(
          trip.trip_number,
          (currentPODCounts.get(trip.trip_number) || 0) + 1
        );
      }
    }

    // Check for resolved duplicate PODs
    for (const [pod, previousCount] of previousPODCounts.current.entries()) {
      const currentCount = currentPODCounts.get(pod) || 0;
      if (previousCount > 1 && currentCount <= 1) {
        try {
          await resolveDuplicatePODAlerts(pod);
        } catch (error) {
          console.error('Error resolving duplicate POD alerts:', error);
        }
      }
    }
    previousPODCounts.current = new Map(currentPODCounts);

    // Resolve specific alerts that were resolved
    if (resolvedIssues.size > 0) {
      console.log('Resolving alerts for', resolvedIssues.size, 'trips');
      for (const [tripId, issues] of resolvedIssues) {
        for (const issue of issues) {
          try {
            const resolutionMap: Record<string, { categories: string[]; issueType: string }> = {
              'missing-revenue': { categories: ['load_exception'], issueType: 'missing_revenue' },
              'flagged-costs': { categories: ['fuel_anomaly'], issueType: 'flagged_costs' },
              'no-costs': { categories: ['fuel_anomaly'], issueType: 'no_costs' },
            };
            const resolution = resolutionMap[issue];
            if (resolution) {
              await resolveAlertsByTrip(tripId, resolution.categories, resolution.issueType);
            }
            processedAlerts.current.delete(`${issue}-${tripId}`);
          } catch (error) {
            console.error(`Error resolving ${issue} alert for trip:`, tripId, error);
          }
        }
      }
    }
  }, [trips, enabled]);

  // Alert creation — runs on an interval (throttled to avoid spamming)
  const createNewAlerts = useCallback(async () => {
    if (!enabled || !trips.length || processingRef.current || !mountedRef.current) return;

    // Check if enough time has passed since last creation run
    const now = Date.now();
    if (now - lastUpdateTime.current < updateInterval) {
      return;
    }

    // Ensure we've loaded existing alerts before creating new ones
    await initializeProcessedAlerts();

    processingRef.current = true;

    try {
      // Track duplicate PODs for new alerts (only non-completed trips)
      const podCounts: Record<string, { count: number; tripIds: string[]; contexts: TripAlertContext[] }> = {};

      // Process trips in batches for creating new alerts
      for (let i = 0; i < trips.length; i += batchSize) {
        if (!mountedRef.current) break;

        const batch = trips.slice(i, i + batchSize);

        for (const trip of batch) {
          if (!mountedRef.current) break;

          const context: TripAlertContext = {
            tripId: trip.id,
            tripNumber: trip.trip_number,
            fleetNumber: trip.fleet_number,
            driverName: trip.driver_name,
            clientName: trip.client_name,
            departureDate: trip.departure_date,
            revenueCurrency: trip.revenue_currency,
          };

          // Track POD for duplicate detection (only non-completed trips)
          if (trip.status !== 'completed') {
            const pod = trip.trip_number;
            if (!podCounts[pod]) {
              podCounts[pod] = { count: 0, tripIds: [], contexts: [] };
            }
            podCounts[pod].count++;
            podCounts[pod].tripIds.push(trip.id);
            podCounts[pod].contexts.push(context);
          }

          // Check for missing revenue — skip if zero_revenue_comment explains it
          const hasMissingRevenue = (!trip.base_revenue || trip.base_revenue === 0) && !trip.zero_revenue_comment;
          if (hasMissingRevenue) {
            const alertKey = `missing-revenue-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              try {
                const alertId = await createMissingRevenueAlert(trip.id, trip.trip_number, context);
                if (alertId) {
                  processedAlerts.current.add(alertKey);
                  onAlertCreated?.(alertId, 'missing_revenue');
                }
              } catch (error) {
                console.error('Error creating missing revenue alert:', error);
              }
            }
          }

          // Check for flagged costs
          if (trip.hasFlaggedCosts && trip.flaggedCostCount) {
            const alertKey = `flagged-costs-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              try {
                const alertId = await createFlaggedCostAlert(trip.id, trip.trip_number, trip.flaggedCostCount, undefined, context);
                if (alertId) {
                  processedAlerts.current.add(alertKey);
                  onAlertCreated?.(alertId, 'flagged_costs');
                }
              } catch (error) {
                console.error('Error creating flagged costs alert:', error);
              }
            }
          }

          // Check for no costs — only for completed trips (active trips may have costs added later)
          if (trip.hasNoCosts && trip.status === 'completed') {
            const alertKey = `no-costs-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              try {
                const alertId = await createNoCostsAlert(trip.id, trip.trip_number, trip.daysInProgress, context);
                if (alertId) {
                  processedAlerts.current.add(alertKey);
                  onAlertCreated?.(alertId, 'no_costs');
                }
              } catch (error) {
                console.error('Error creating no costs alert:', error);
              }
            }
          }
        }

        // Add delay between batches to prevent overwhelming the system
        if (i + batchSize < trips.length && mountedRef.current) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      // Check for duplicate PODs (create new alerts if needed)
      if (mountedRef.current) {
        for (const [pod, { count, tripIds, contexts }] of Object.entries(podCounts)) {
          if (count > 1) {
            const alertKey = `duplicate-pod-${pod}`;
            if (!processedAlerts.current.has(alertKey)) {
              try {
                const alertId = await createDuplicatePODAlert(pod, count, tripIds, contexts[0]);
                if (alertId) {
                  processedAlerts.current.add(alertKey);
                  onAlertCreated?.(alertId, 'duplicate_pod');
                }
              } catch (error) {
                console.error('Error creating duplicate POD alert:', error);
              }
            }
          }
        }
      }

      lastUpdateTime.current = Date.now();
    } catch (error) {
      console.error('Error creating trip alerts:', error);
    } finally {
      processingRef.current = false;
    }
  }, [trips, enabled, batchSize, delayBetweenBatches, updateInterval, onAlertCreated, initializeProcessedAlerts]);

  // Run resolution checks whenever trip data changes (no throttle)
  const tripsRef = useRef(trips);
  useEffect(() => {
    // Only run if trips data actually changed (reference comparison)
    if (tripsRef.current === trips) return;
    tripsRef.current = trips;

    if (enabled && trips.length > 0) {
      checkForResolutions();
    }
  }, [trips, enabled, checkForResolutions]);

  // Run alert creation on a schedule
  useEffect(() => {
    mountedRef.current = true;

    const runAlertCreation = async () => {
      // On first run, also populate previousTripStates for resolution tracking
      if (previousTripStates.current.size === 0) {
        for (const trip of trips) {
          previousTripStates.current.set(trip.id, { ...trip });
        }
      }
      await createNewAlerts();

      // Schedule next check
      if (mountedRef.current) {
        timeoutRef.current = setTimeout(runAlertCreation, updateInterval);
      }
    };

    if (enabled) {
      runAlertCreation();
    }

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, updateInterval, createNewAlerts, trips]);

  // Return function to manually trigger alert checks
  const refreshAlerts = useCallback(() => {
    processedAlerts.current.clear();
    previousTripStates.current.clear();
    previousPODCounts.current.clear();
    lastUpdateTime.current = 0; // Reset last update time to force immediate check
    initializedRef.current = false; // Allow re-initialization to reload cache
  }, []);

  // Function to force an immediate check (bypasses the interval)
  const forceCheck = useCallback(async () => {
    lastUpdateTime.current = 0;
    await createNewAlerts();
  }, [createNewAlerts]);

  return { refreshAlerts, forceCheck };
}