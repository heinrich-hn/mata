import { useEffect, useRef, useCallback } from 'react';
import {
  createDuplicatePODAlert,
  createMissingRevenueAlert,
  createFlaggedCostAlert,
  createNoCostsAlert,
  createLongRunningTripAlert,
  createFlaggedTripAlert,
} from '@/lib/tripAlerts';
import { resolveAlertsByTrip, resolveDuplicatePODAlerts } from '@/lib/resolveAlerts';
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

  // Memoize the check function to avoid recreating it unnecessarily
  const checkTripsForAlerts = useCallback(async () => {
    if (!enabled || !trips.length || processingRef.current || !mountedRef.current) return;

    // Check if enough time has passed since last update
    const now = Date.now();
    if (now - lastUpdateTime.current < updateInterval) {
      return;
    }

    processingRef.current = true;

    try {
      // Track current POD counts for duplicate detection
      const currentPODCounts: Map<string, number> = new Map();

      // Track which trips have issues resolved
      const resolvedTrips = new Set<string>();

      // Compare with previous state to detect resolved issues
      for (const trip of trips) {
        const previousTrip = previousTripStates.current.get(trip.id);

        if (previousTrip) {
          // Check if issues were resolved
          const hadMissingRevenue = !previousTrip.base_revenue || previousTrip.base_revenue === 0;
          const hasMissingRevenueNow = !trip.base_revenue || trip.base_revenue === 0;

          const hadFlaggedCosts = previousTrip.hasFlaggedCosts;
          const hasFlaggedCostsNow = trip.hasFlaggedCosts;

          const hadNoCosts = previousTrip.hasNoCosts;
          const hasNoCostsNow = trip.hasNoCosts;

          const wasLongRunning = previousTrip.daysInProgress ? previousTrip.daysInProgress > 14 : false;
          const isLongRunningNow = trip.daysInProgress ? trip.daysInProgress > 14 : false;

          const wasFlagged = !!(previousTrip.validation_notes ||
            (previousTrip.delay_reasons && previousTrip.delay_reasons.length > 0) ||
            previousTrip.completion_validation ||
            (previousTrip.edit_history && previousTrip.edit_history.length > 0) ||
            previousTrip.hasIssues);

          const isFlaggedNow = !!(trip.validation_notes ||
            (trip.delay_reasons && trip.delay_reasons.length > 0) ||
            trip.completion_validation ||
            (trip.edit_history && trip.edit_history.length > 0) ||
            trip.hasIssues);

          // If any issue was resolved, mark for alert resolution
          if ((hadMissingRevenue && !hasMissingRevenueNow) ||
            (hadFlaggedCosts && !hasFlaggedCostsNow) ||
            (hadNoCosts && !hasNoCostsNow) ||
            (wasLongRunning && !isLongRunningNow) ||
            (wasFlagged && !isFlaggedNow)) {
            resolvedTrips.add(trip.id);
          }
        }

        // Update previous state for next comparison
        previousTripStates.current.set(trip.id, { ...trip });

        // Track POD counts for duplicate detection
        currentPODCounts.set(
          trip.trip_number,
          (currentPODCounts.get(trip.trip_number) || 0) + 1
        );
      }

      // Check for resolved duplicate PODs
      for (const [pod, previousCount] of previousPODCounts.current.entries()) {
        const currentCount = currentPODCounts.get(pod) || 0;

        // If duplicate POD alert existed but now there's only one or zero
        if (previousCount > 1 && currentCount <= 1) {
          try {
            await resolveDuplicatePODAlerts(pod);
          } catch (error) {
            console.error('Error resolving duplicate POD alerts:', error);
          }
        }
      }

      // Update previous POD counts
      previousPODCounts.current = new Map(currentPODCounts);

      // Resolve alerts for trips that no longer have issues
      if (resolvedTrips.size > 0) {
        for (const tripId of resolvedTrips) {
          try {
            await resolveAlertsByTrip(tripId);
            // Remove from processed alerts to allow re-creation if issue returns
            const keysToDelete: string[] = [];
            processedAlerts.current.forEach(key => {
              if (key.includes(tripId)) {
                keysToDelete.push(key);
              }
            });
            keysToDelete.forEach(key => processedAlerts.current.delete(key));
          } catch (error) {
            console.error('Error resolving alerts for trip:', tripId, error);
          }
        }
      }

      // Track duplicate PODs for new alerts
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

          // Track POD for duplicate detection
          const pod = trip.trip_number;
          if (!podCounts[pod]) {
            podCounts[pod] = { count: 0, tripIds: [], contexts: [] };
          }
          podCounts[pod].count++;
          podCounts[pod].tripIds.push(trip.id);
          podCounts[pod].contexts.push(context);

          // Check for missing revenue (only if issue exists)
          if (!trip.base_revenue || trip.base_revenue === 0) {
            const alertKey = `missing-revenue-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              processedAlerts.current.add(alertKey);
              try {
                const alertId = await createMissingRevenueAlert(trip.id, trip.trip_number, context);
                onAlertCreated?.(alertId, 'missing_revenue');
              } catch (error) {
                console.error('Error creating missing revenue alert:', error);
              }
            }
          }

          // Check for flagged costs
          if (trip.hasFlaggedCosts && trip.flaggedCostCount) {
            const alertKey = `flagged-costs-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              processedAlerts.current.add(alertKey);
              try {
                const alertId = await createFlaggedCostAlert(trip.id, trip.trip_number, trip.flaggedCostCount, undefined, context);
                onAlertCreated?.(alertId, 'flagged_costs');
              } catch (error) {
                console.error('Error creating flagged costs alert:', error);
              }
            }
          }

          // Check for no costs
          if (trip.hasNoCosts) {
            const alertKey = `no-costs-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              processedAlerts.current.add(alertKey);
              try {
                const alertId = await createNoCostsAlert(trip.id, trip.trip_number, trip.daysInProgress, context);
                onAlertCreated?.(alertId, 'no_costs');
              } catch (error) {
                console.error('Error creating no costs alert:', error);
              }
            }
          }

          // Check for long-running trips
          if (trip.daysInProgress && trip.daysInProgress > 14) {
            const alertKey = `long-running-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              processedAlerts.current.add(alertKey);
              try {
                const alertId = await createLongRunningTripAlert(trip.id, trip.trip_number, trip.daysInProgress, context);
                onAlertCreated?.(alertId, 'long_running');
              } catch (error) {
                console.error('Error creating long running alert:', error);
              }
            }
          }

          // Check for flagged trips
          if (trip.validation_notes ||
            (trip.delay_reasons && trip.delay_reasons.length > 0) ||
            trip.completion_validation ||
            (trip.edit_history && trip.edit_history.length > 0) ||
            trip.hasIssues) {

            const alertKey = `flagged-trip-${trip.id}`;
            if (!processedAlerts.current.has(alertKey)) {
              processedAlerts.current.add(alertKey);

              let reason = 'Trip has been flagged for review';
              if (trip.validation_notes) {
                reason = `Validation notes: ${trip.validation_notes}`;
              } else if (trip.delay_reasons && trip.delay_reasons.length > 0) {
                const delayReason = trip.delay_reasons[0]?.reason || 'Trip has delays';
                reason = delayReason;
              } else if (trip.completion_validation) {
                reason = 'Trip completion requires validation';
              } else if (trip.edit_history && trip.edit_history.length > 0) {
                reason = 'Trip has been edited and needs review';
              }

              try {
                const alertId = await createFlaggedTripAlert(
                  trip.id,
                  trip.trip_number,
                  reason,
                  context
                );
                onAlertCreated?.(alertId, 'flagged_trip');
              } catch (error) {
                console.error('Error creating flagged trip alert:', error);
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
              processedAlerts.current.add(alertKey);
              try {
                const alertId = await createDuplicatePODAlert(pod, count, tripIds, contexts[0]);
                onAlertCreated?.(alertId, 'duplicate_pod');
              } catch (error) {
                console.error('Error creating duplicate POD alert:', error);
              }
            }
          }
        }
      }

      lastUpdateTime.current = Date.now();
    } catch (error) {
      console.error('Error checking trips for alerts:', error);
    } finally {
      processingRef.current = false;
    }
  }, [trips, enabled, batchSize, delayBetweenBatches, updateInterval, onAlertCreated]);

  useEffect(() => {
    mountedRef.current = true;

    const runAlertCheck = async () => {
      await checkTripsForAlerts();

      // Schedule next check
      if (mountedRef.current) {
        timeoutRef.current = setTimeout(runAlertCheck, updateInterval);
      }
    };

    if (enabled) {
      runAlertCheck();
    }

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, updateInterval, checkTripsForAlerts]); // Now includes checkTripsForAlerts

  // Return function to manually trigger alert checks
  const refreshAlerts = useCallback(() => {
    processedAlerts.current.clear();
    previousTripStates.current.clear();
    previousPODCounts.current.clear();
    lastUpdateTime.current = 0; // Reset last update time to force immediate check
  }, []);

  // Function to force an immediate check (bypasses the interval)
  const forceCheck = useCallback(async () => {
    lastUpdateTime.current = 0;
    await checkTripsForAlerts();
  }, [checkTripsForAlerts]);

  return { refreshAlerts, forceCheck };
}