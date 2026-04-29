import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { driverAnalyzer, type TrackPoint } from "@/utils/driverBehaviorAnalysis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useDriverBehaviorEvents = () => {
  return useQuery({
    queryKey: ["driver-behavior-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_behavior_events")
        .select("*")
        .order("event_date", { ascending: false })
        .order("event_time", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

/**
 * Analyze trip and save driver behavior events
 */
export const useAnalyzeTrip = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      vehicleId: _vehicleId,
      _driverId,
      trackPoints,
      speedLimit,
      map
    }: {
      vehicleId: string;
      _driverId: string;
      trackPoints: TrackPoint[];
      speedLimit: number;
      map: L.Map;
    }) => {
      // Analyze trip using Phase 5 DriverBehaviorAnalyzer
      const score = driverAnalyzer.calculateDriverScore(map, trackPoints, speedLimit);
      const corners = driverAnalyzer.detectHarshCorners(map, trackPoints);
      const speeding = driverAnalyzer.detectSpeedingEvents(trackPoints, speedLimit);
      const distance = driverAnalyzer.calculateTotalDistance(trackPoints);
      const avgSpeed = driverAnalyzer.calculateAverageSpeed(trackPoints);

      // TODO: Save events to database when table schema is updated
      // The driver_behavior_events table needs columns: incident_id, event_type, event_date, event_time, location_lat, location_lng, severity, details
      console.log('Trip Analysis:', {
        score,
        corners: corners.length,
        speeding: speeding.length,
        distance,
        avgSpeed
      });

      return score;
    },
    onSuccess: (score) => {
      queryClient.invalidateQueries({ queryKey: ['driver-behavior-events'] });
      toast({
        title: 'Trip Analyzed',
        description: `Driver score: ${score.score}/100`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

/**
 * Delete a driver behavior event
 */
export const useDeleteDriverBehaviorEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("driver_behavior_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
      toast({
        title: "Event Deleted",
        description: "The driver behavior event has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Bulk delete driver behavior events
 */
export const useBulkDeleteDriverBehaviorEvents = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const { error } = await supabase
        .from("driver_behavior_events")
        .delete()
        .in("id", eventIds);

      if (error) throw error;
      return eventIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["driver-behavior-events"] });
      toast({
        title: "Events Deleted",
        description: `Successfully deleted ${count} event${count !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

/**
 * Get driver performance summary with event counts per driver
 */
export const useDriverPerformanceSummary = () => {
  return useQuery({
    queryKey: ["driver-performance-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_behavior_events")
        .select("driver_name, severity, event_type, points, status, risk_score");

      if (error) throw error;

      // Aggregate data per driver
      const driverMap = new Map<string, {
        driver_name: string;
        total_events: number;
        critical_events: number;
        high_events: number;
        medium_events: number;
        low_events: number;
        total_points: number;
        open_events: number;
        resolved_events: number;
        event_types: Record<string, number>;
        risk_score_total: number;
        risk_score_count: number;
        avg_risk_score: number | null;
        max_risk_score: number | null;
        risk_by_event_type: Record<string, { total: number; count: number; avg: number }>;
      }>();

      data?.forEach((event) => {
        const existing = driverMap.get(event.driver_name) || {
          driver_name: event.driver_name,
          total_events: 0,
          critical_events: 0,
          high_events: 0,
          medium_events: 0,
          low_events: 0,
          total_points: 0,
          open_events: 0,
          resolved_events: 0,
          event_types: {},
          risk_score_total: 0,
          risk_score_count: 0,
          avg_risk_score: null,
          max_risk_score: null,
          risk_by_event_type: {},
        };

        existing.total_events++;
        existing.total_points += event.points || 0;

        // Count by severity
        const severity = (event.severity || "medium").toLowerCase();
        if (severity === "critical") existing.critical_events++;
        else if (severity === "high") existing.high_events++;
        else if (severity === "medium") existing.medium_events++;
        else existing.low_events++;

        // Count by status
        const status = (event.status || "open").toLowerCase();
        if (status === "open" || status === "pending") existing.open_events++;
        else existing.resolved_events++;

        // Count by event type
        const eventType = event.event_type || "unknown";
        existing.event_types[eventType] = (existing.event_types[eventType] || 0) + 1;

        // Risk score aggregation (only count assigned scores)
        if (typeof event.risk_score === "number") {
          existing.risk_score_total += event.risk_score;
          existing.risk_score_count++;
          existing.max_risk_score = Math.max(
            existing.max_risk_score ?? 0,
            event.risk_score,
          );

          const bucket = existing.risk_by_event_type[eventType] || { total: 0, count: 0, avg: 0 };
          bucket.total += event.risk_score;
          bucket.count++;
          bucket.avg = bucket.total / bucket.count;
          existing.risk_by_event_type[eventType] = bucket;
        }

        driverMap.set(event.driver_name, existing);
      });

      // Finalise avg risk score per driver
      driverMap.forEach((v) => {
        v.avg_risk_score = v.risk_score_count > 0
          ? v.risk_score_total / v.risk_score_count
          : null;
      });

      return Array.from(driverMap.values()).sort((a, b) => b.total_events - a.total_events);
    },
  });
};