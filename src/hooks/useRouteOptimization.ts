// src/hooks/useRouteOptimization.ts
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useCallback, useMemo, useState } from "react";

// Use database types
type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
type RouteOptimizationInsert = Database["public"]["Tables"]["route_optimizations"]["Insert"];

// Define a simplified Load type
type LoadData = {
  id: string;
  load_number: string;
  origin: string;
  destination: string;
  pickup_datetime: string;
  delivery_datetime: string | null;
  status: string;
  [key: string]: unknown;
};

// Enhanced waypoint interface with enterprise features
interface Waypoint {
  id?: string;
  lat: number;
  lng: number;
  name: string;
  type?: 'pickup' | 'delivery' | 'rest_stop' | 'customs' | 'weigh_station';
  priority?: 'high' | 'medium' | 'low';
  timeWindow?: {
    earliest: string; // HH:MM format
    latest: string;   // HH:MM format
  };
  serviceTime?: number; // Minutes required at this location
  vehicleRestrictions?: string[]; // Vehicle type restrictions
}

interface RouteOptimizationResult {
  waypoints: Waypoint[];
  optimized_sequence: number[];
  total_distance_km: number;
  estimated_duration_mins: number;
  estimated_fuel_litres?: number;
  estimated_fuel_cost?: number;
  // Enhanced enterprise analytics
  optimization_score?: number; // 0-100 quality score
  alternatives_considered?: number;
  constraint_violations?: string[];
  time_window_violations?: number;
  total_service_time?: number;
  optimization_method?: string;
  calculation_time_ms?: number;
}

// Enhanced distance calculation with caching
const distanceCache = new Map<string, number>();

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const cacheKey = `${lat1.toFixed(6)},${lng1.toFixed(6)}-${lat2.toFixed(6)},${lng2.toFixed(6)}`;

  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Cache the result
  distanceCache.set(cacheKey, distance);

  // Limit cache size to prevent memory issues
  if (distanceCache.size > 10000) {
    const firstKey = distanceCache.keys().next().value;
    distanceCache.delete(firstKey);
  }

  return distance;
};

// Enhanced time window validation
const validateTimeWindows = (waypoints: Waypoint[], route: number[], avgSpeed: number = 80): {
  violations: number;
  details: string[];
} => {
  let currentTime = 0; // Start at time 0 (minutes from start)
  let violations = 0;
  const details: string[] = [];

  for (let i = 0; i < route.length; i++) {
    const waypointIndex = route[i];
    const waypoint = waypoints[waypointIndex];

    if (i > 0) {
      // Add travel time from previous waypoint
      const prevIndex = route[i - 1];
      const distance = calculateDistance(
        waypoints[prevIndex].lat,
        waypoints[prevIndex].lng,
        waypoint.lat,
        waypoint.lng
      );
      const travelTime = (distance / avgSpeed) * 60; // Convert to minutes
      currentTime += travelTime;
    }

    // Check time window constraints
    if (waypoint.timeWindow) {
      const [earliestHour, earliestMin] = waypoint.timeWindow.earliest.split(':').map(Number);
      const [latestHour, latestMin] = waypoint.timeWindow.latest.split(':').map(Number);

      const earliestMinutes = earliestHour * 60 + earliestMin;
      const latestMinutes = latestHour * 60 + latestMin;

      if (currentTime < earliestMinutes) {
        // Arrive early - wait until earliest time
        currentTime = earliestMinutes;
      } else if (currentTime > latestMinutes) {
        // Arrive late - violation
        violations++;
        const lateBy = currentTime - latestMinutes;
        details.push(`${waypoint.name}: Late by ${Math.round(lateBy)} minutes`);
      }
    }

    // Add service time
    if (waypoint.serviceTime) {
      currentTime += waypoint.serviceTime;
    }
  }

  return { violations, details };
};

// Enhanced 2-opt improvement algorithm with early termination
const improve2Opt = (waypoints: Waypoint[], route: number[], maxIterations: number = 100): number[] => {
  if (waypoints.length <= 3) return route;

  let improved = true;
  let bestRoute = [...route];
  let iterations = 0;
  let bestDistance = calculateTotalDistance(waypoints, bestRoute);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        const newRoute = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];

        const newDistance = calculateTotalDistance(waypoints, newRoute);

        if (newDistance < bestDistance) {
          bestRoute = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
};

// Helper function to calculate total distance
const calculateTotalDistance = (waypoints: Waypoint[], route: number[]): number => {
  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const current = waypoints[route[i]];
    const next = waypoints[route[i + 1]];
    totalDistance += calculateDistance(current.lat, current.lng, next.lat, next.lng);
  }
  return totalDistance;
};

// Enhanced optimization criteria interface
interface OptimizationCriteria {
  weights?: {
    distance?: number;
    time?: number;
    fuel?: number;
    driver?: number;
    timeWindows?: number;
  };
  constraints?: {
    maxIterations?: number;
    maxDrivingHours?: number;
    trafficConsideration?: boolean;
    mandatoryBreaks?: boolean;
    timeWindows?: boolean;
    vehicleCapacity?: number;
    maxServiceTime?: number;
  };
}

// Enhanced enterprise multi-criteria optimization
const optimizeRouteEnterprise = (waypoints: Waypoint[], criteria: OptimizationCriteria): number[] => {
  if (waypoints.length <= 2) return waypoints.map((_, i) => i);

  const priorityWeights = { high: 0.7, medium: 1.0, low: 1.3 }; // Lower is better
  const typeWeights = {
    pickup: 0.8,      // Prioritize pickups early
    delivery: 1.0,    // Standard priority
    customs: 0.6,     // Handle customs efficiently
    rest_stop: 1.2,   // Flexible timing
    weigh_station: 0.9 // Important for compliance
  };

  // Enhanced nearest neighbor with multiple criteria
  const unvisited = new Set(waypoints.map((_, i) => i));
  const route: number[] = [0];
  unvisited.delete(0);

  while (unvisited.size > 0) {
    const current = route[route.length - 1];
    let best = -1;
    let minScore = Infinity;

    for (const index of unvisited) {
      const distance = calculateDistance(
        waypoints[current].lat,
        waypoints[current].lng,
        waypoints[index].lat,
        waypoints[index].lng
      );

      // Multi-criteria scoring system
      let score = distance * (criteria.weights?.distance || 0.4);

      // Priority weighting
      const priority = waypoints[index].priority || 'medium';
      score *= priorityWeights[priority];

      // Type weighting
      const waypointType = waypoints[index].type || 'delivery';
      if (waypointType in typeWeights) {
        score *= typeWeights[waypointType as keyof typeof typeWeights];
      }

      // Time window urgency
      if (waypoints[index].timeWindow && criteria.constraints?.timeWindows) {
        const [latestHour, latestMin] = waypoints[index].timeWindow.latest.split(':').map(Number);
        const urgency = (24 * 60) - (latestHour * 60 + latestMin); // Minutes until end of day
        score *= (1 - urgency / (24 * 60)) * (criteria.weights?.timeWindows || 0.2) + 1;
      }

      if (score < minScore) {
        minScore = score;
        best = index;
      }
    }

    if (best !== -1) {
      route.push(best);
      unvisited.delete(best);
    }
  }

  // Apply enhanced 2-opt
  return improve2Opt(waypoints, route, criteria.constraints?.maxIterations || 100);
};

export const useRouteOptimization = () => {
  const { toast } = useToast();
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Memoized distance calculation for performance
  const memoizedCalculateDistance = useMemo(() => calculateDistance, []);

  const optimizeRoute = useCallback(
    async (waypoints: Waypoint[], options?: {
        avgSpeed?: number;
        fuelConsumption?: number;
        fuelPrice?: number;
        currency?: string;
        weights?: {
          distance?: number;
          time?: number;
          fuel?: number;
          driver?: number;
          timeWindows?: number;
        };
        constraints?: {
          maxIterations?: number;
          maxDrivingHours?: number;
          trafficConsideration?: boolean;
          mandatoryBreaks?: boolean;
          timeWindows?: boolean;
          vehicleCapacity?: number;
          maxServiceTime?: number;
        };
      }): Promise<RouteOptimizationResult> => {
      setIsOptimizing(true);
      const startTime = Date.now();

      try {
        // Enhanced validation
        if (waypoints.length > 100) {
          throw new Error("Too many waypoints. Maximum is 100 for optimal performance.");
        }

        if (waypoints.length < 2) {
          throw new Error("At least 2 waypoints are required for optimization.");
        }

        // Validate coordinates
        const invalidWaypoints = waypoints.filter(wp =>
          typeof wp.lat !== 'number' ||
          typeof wp.lng !== 'number' ||
          wp.lat < -90 || wp.lat > 90 ||
          wp.lng < -180 || wp.lng > 180
        );

        if (invalidWaypoints.length > 0) {
          throw new Error(`Invalid coordinates detected in ${invalidWaypoints.length} waypoint(s).`);
        }

        // Determine optimization method
        const useEnterpriseOptimization = options?.weights || options?.constraints;
        const optimizationMethod = useEnterpriseOptimization ? "enterprise_multi_criteria" : "basic_2opt";

        const optimizedSequence = useEnterpriseOptimization
          ? optimizeRouteEnterprise(waypoints, options)
          : improve2Opt(waypoints, waypoints.map((_, i) => i));

        // Calculate metrics
        const totalDistance = calculateTotalDistance(waypoints, optimizedSequence);
        const avgSpeed = options?.avgSpeed || 80;
        const estimatedDuration = (totalDistance / avgSpeed) * 60;

        // Calculate service time
        const totalServiceTime = waypoints.reduce((sum, wp) => sum + (wp.serviceTime || 0), 0);
        const totalDurationWithService = estimatedDuration + totalServiceTime;

        // Fuel calculations
        const fuelConsumption = options?.fuelConsumption || 30;
        const estimatedFuel = (totalDistance * fuelConsumption) / 100;
        const fuelPrice = options?.fuelPrice || 22;
        const estimatedCost = estimatedFuel * fuelPrice;

        // Enhanced analytics
        const constraintViolations: string[] = [];
        let timeWindowViolations = 0;
        let alternativesConsidered = 1;

        if (useEnterpriseOptimization) {
          alternativesConsidered = Math.min(waypoints.length * waypoints.length, 1000);

          // Check driving hours constraint
          if (options?.constraints?.maxDrivingHours) {
            const estimatedHours = totalDurationWithService / 60;
            if (estimatedHours > options.constraints.maxDrivingHours) {
              constraintViolations.push(
                `Driving time exceeds limit: ${estimatedHours.toFixed(1)}h > ${options.constraints.maxDrivingHours}h`
              );
            }
          }

          // Check time window constraints
          if (options?.constraints?.timeWindows) {
            const timeWindowCheck = validateTimeWindows(waypoints, optimizedSequence, avgSpeed);
            timeWindowViolations = timeWindowCheck.violations;
            constraintViolations.push(...timeWindowCheck.details);
          }

          // Check service time constraints
          if (options?.constraints?.maxServiceTime && totalServiceTime > options.constraints.maxServiceTime) {
            constraintViolations.push(
              `Total service time exceeds limit: ${totalServiceTime}min > ${options.constraints.maxServiceTime}min`
            );
          }
        }

        // Calculate optimization quality score
        const baselineDistance = calculateTotalDistance(waypoints, waypoints.map((_, i) => i));
        const optimizationScore = baselineDistance > 0
          ? Math.max(0, Math.min(100, ((baselineDistance - totalDistance) / baselineDistance) * 100))
          : 85;

        const calculationTime = Date.now() - startTime;

        const result: RouteOptimizationResult = {
          waypoints,
          optimized_sequence: optimizedSequence,
          total_distance_km: Math.round(totalDistance * 10) / 10,
          estimated_duration_mins: Math.round(totalDurationWithService),
          estimated_fuel_litres: Math.round(estimatedFuel * 10) / 10,
          estimated_fuel_cost: Math.round(estimatedCost * 100) / 100,
          optimization_score: Math.round(optimizationScore),
          alternatives_considered: alternativesConsidered,
          constraint_violations: constraintViolations,
          time_window_violations: timeWindowViolations,
          total_service_time: totalServiceTime,
          optimization_method: optimizationMethod,
          calculation_time_ms: calculationTime
        };

        console.log(`✅ Route optimized in ${calculationTime}ms using ${optimizationMethod}: ${result.total_distance_km}km, ${result.estimated_duration_mins} mins, ${options?.currency || 'R'}${result.estimated_fuel_cost} (Score: ${result.optimization_score}%)`);

        return result;
      } catch (error) {
        console.error("Route optimization error:", error);
        toast({
          title: "Optimization Failed",
          description: error instanceof Error ? error.message : "Failed to optimize route. Please check your waypoints and try again.",
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsOptimizing(false);
      }
    },

    [toast]
  );

  const ensureTripExists = useCallback(
    async (loadId: string | null): Promise<string> => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Authentication required. Please log in to continue.");
        }

        if (loadId) {
          // Check if trip already exists for this load
          // Note: loads.assigned_trip_id references trips.id
          const { data: loadRecord } = await supabase
            .from("loads")
            .select("assigned_trip_id")
            .eq("id", loadId)
            .maybeSingle();

          if (loadRecord?.assigned_trip_id) {
            console.log("✅ Using existing trip:", loadRecord.assigned_trip_id);
            return loadRecord.assigned_trip_id;
          }

          // Fetch load data to create a trip
          const { data: loadData, error: loadError } = await supabase
            .from("loads")
            .select("id, load_number, origin, destination, pickup_datetime, delivery_datetime, status")
            .eq("id", loadId)
            .single();

          if (loadError) throw loadError;

          const load = loadData as LoadData;

          // Create trip payload
          const tripPayload: TripInsert = {
            trip_number: `TRIP-${load.load_number}-${Date.now()}`,
            origin: load.origin,
            destination: load.destination,
            status: "active",
          };

          const { data: newTrip, error: createError } = await supabase
            .from("trips")
            .insert(tripPayload)
            .select()
            .single();

          if (createError) throw createError;

          console.log("✅ Created new trip:", newTrip.id);
          toast({
            title: "Trip Created",
            description: `Trip ${newTrip.trip_number} has been created for load ${load.load_number}.`,
          });

          return newTrip.id;
        }

        // Create a standalone trip
        const tripNumber = `TRIP-${Date.now()}`;
        const standaloneTripPayload: TripInsert = {
          trip_number: tripNumber,
          origin: "Unknown",
          destination: "Unknown",
          status: "planned",
        };

        const { data: newTrip, error: createError } = await supabase
          .from("trips")
          .insert(standaloneTripPayload)
          .select()
          .single();

        if (createError) throw createError;

        console.log("✅ Created standalone trip:", newTrip.id);
        toast({
          title: "Trip Created",
          description: `Standalone trip ${tripNumber} has been created.`,
        });

        return newTrip.id;
      } catch (error) {
        console.error("Error ensuring trip exists:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to create or retrieve trip";
        toast({
          title: "Trip Creation Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast]
  );

  const saveOptimization = useCallback(
    async (tripId: string, optimization: RouteOptimizationResult) => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Authentication required. Please log in to save the optimization.");
        }

        // Deselect other optimizations for this trip
        await supabase
          .from("route_optimizations")
          .update({ selected: false })
          .eq("trip_id", tripId);

        // Prepare waypoints data
        const waypointsJson = optimization.waypoints.map(wp => ({
          id: wp.id ?? null,
          lat: wp.lat,
          lng: wp.lng,
          name: wp.name,
          type: wp.type ?? null,
          priority: wp.priority ?? null,
          timeWindow: wp.timeWindow ?? null,
          serviceTime: wp.serviceTime ?? null,
        }));

        // Create optimization payload
        const optimizationPayload: RouteOptimizationInsert = {
          trip_id: tripId,
          waypoints: waypointsJson,
          optimized_sequence: optimization.optimized_sequence,
          total_distance_km: optimization.total_distance_km,
          estimated_duration_mins: optimization.estimated_duration_mins,
          estimated_fuel_litres: optimization.estimated_fuel_litres ?? null,
          estimated_fuel_cost: optimization.estimated_fuel_cost ?? null,
          optimization_algorithm: optimization.optimization_method || "basic_2opt",
          created_by: user.id,
          selected: true,
        };

        const { data, error } = await supabase
          .from("route_optimizations")
          .insert(optimizationPayload)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Route Saved Successfully",
          description: `Optimized route with ${optimization.waypoints.length} waypoints has been saved.`,
        });

        return data;
      } catch (error) {
        console.error("Save optimization error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to save optimization";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast]
  );

  // Clear distance cache when component unmounts
  const clearCache = useCallback(() => {
    distanceCache.clear();
  }, []);

  return {
    optimizeRoute,
    saveOptimization,
    ensureTripExists,
    isOptimizing,
    calculateDistance: memoizedCalculateDistance,
    clearCache,
  };
};