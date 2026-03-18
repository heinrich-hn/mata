import { EnhancedProgressDashboard } from '@/components/loads/EnhancedProgressDashboard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeofenceTracking } from "@/hooks/useGeofenceTracking";
import { useSingleLoadRealtime } from "@/hooks/useLoadRealtime";
import type { LoadWialonSync } from "@/hooks/useWialonLoadIntegration";
import { useWialonLoadIntegration } from "@/hooks/useWialonLoadIntegration";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useWialonContext } from "@/integrations/wialon";
import type { VehicleLocation } from "@/integrations/wialon/useWialon";
import { routeGeometry } from "@/utils/routeGeometry";
import type { PostgrestError } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { LatLng } from "leaflet";
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Clock, MapPin, Navigation, RefreshCw, Route as RouteIcon, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnhancedTrackVisualization } from "./EnhancedTrackVisualization";
import { LoadRealtimeIndicator } from "./LoadRealtimeIndicator";
import { LoadStatusWorkflow } from "./LoadStatusWorkflow";
import { LoadUpdateTimeline } from "./LoadUpdateTimeline";
import type { LoadStatus } from '@/constants/loadStatusWorkflow';

// Types
type DeliveryTracking = Database["public"]["Tables"]["delivery_tracking"]["Row"];
type DeliveryEvent = Database["public"]["Tables"]["delivery_events"]["Row"];
type DeliveryEta = Database["public"]["Tables"]["delivery_eta"]["Row"];
type Load = Database["public"]["Tables"]["loads"]["Row"] & {
  assigned_vehicle?: {
    id: string;
    wialon_unit_id: number;
    name: string;
    registration: string | null;
  } | null;
};

interface LiveDeliveryTrackingProps {
  loadId: string;
}

// Constants
const REFRESH_INTERVAL = 10000; // 10 seconds
const SIGNAL_QUALITY_THRESHOLD = 30000; // 30 seconds
const SPEED_THRESHOLDS = {
  HIGH_SPEED: 80,
  DANGEROUS_SPEED: 100,
} as const;

const ECO_DRIVING_THRESHOLDS = {
  IDLE_WARNING: 5, // minutes
  SPEED_PENALTY_START: 80, // km/h
  SPEED_PENALTY_MULTIPLIER: 2,
} as const;

export const LiveDeliveryTracking = ({ loadId }: LiveDeliveryTrackingProps) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { vehicleLocations, isConnected, refreshUnits } = useWialonContext();

  // Advanced Wialon-Load Integration
  const {
    syncState,
    isTracking,
    pendingStatusUpdates,
    toggleAutoSync,
    manualRefresh: refreshIntegration,
    updateStatus,
    isUpdatingStatus,
  } = useWialonLoadIntegration(loadId);

  // Geofence tracking - monitors vehicle locations and checks for geofence entries
  useGeofenceTracking();

  // Real-time load updates
  useSingleLoadRealtime(loadId, {
    enableNotifications: true,
    onUpdate: (payload) => {
      console.log('Load updated in real-time:', payload);
    }
  });

  // Data fetching hooks
  const { data: load } = useLoadQuery(loadId);
  const { data: mappedVehicle } = useMappedVehicleQuery(load?.assigned_vehicle?.wialon_unit_id);
  const {
    data: latestTracking,
    isLoading: trackingLoading,
    error: trackingError,
    refetch: refetchTracking
  } = useTrackingQuery(loadId, autoRefresh);
  const { data: events = [] } = useEventsQuery(loadId);
  const { data: currentEta } = useETAQuery(loadId);

  // Vehicle GPS data
  const vehicleGPS = useMemo(() => {
    if (!load?.assigned_vehicle) return null;
    return vehicleLocations.find(
      loc => loc.vehicleName === load.assigned_vehicle?.name ||
             loc.vehicleId === load.assigned_vehicle?.registration
    ) || null;
  }, [vehicleLocations, load?.assigned_vehicle]);

  // Auto-refresh GPS data
  useEffect(() => {
    if (!autoRefresh || !isConnected) return;

    const interval = setInterval(() => {
      refreshUnits();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [autoRefresh, isConnected, refreshUnits]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`delivery-${loadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "delivery_tracking",
        filter: `load_id=eq.${loadId}`,
      }, () => {
        refetchTracking();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, refetchTracking]);

  // Event handlers
  const handleRefresh = useCallback(() => {
    refetchTracking();
    if (isConnected) refreshUnits();
    refreshIntegration();
  }, [refetchTracking, isConnected, refreshUnits, refreshIntegration]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  if (!load) return null;

  // Error handling
  if (isTrackingTablesError(trackingError)) {
    return <TrackingNotConfiguredCard load={load} />;
  }

  return (
    <div className="space-y-6">
      <TrackingHeader
        load={load}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={toggleAutoRefresh}
        onRefresh={handleRefresh}
      />

      {/* Route Deviation Alert */}
      {syncState?.routeDeviation && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Route Deviation Detected</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Vehicle is {syncState.routeDeviation.deviationDistance.toFixed(0)}m off route
              (Severity: <span className="font-semibold">{syncState.routeDeviation.severity}</span>)
            </p>
            {syncState.routeDeviation.alternativeRoute && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setActiveTab('visualization')}>
                  View Alternative Route
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Status Updates */}
      {pendingStatusUpdates.length > 0 && (
        <div className="space-y-2">
          {pendingStatusUpdates.map((update, idx) => (
            <Alert key={idx}>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Status Update Recommended</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Change status to <span className="font-semibold">"{update.newStatus}"</span> based on geofence event
                  at {update.geofenceEvent.geofenceName}
                </span>
                <Button
                  size="sm"
                  onClick={() => updateStatus({ newStatus: update.newStatus })}
                  disabled={isUpdatingStatus}
                >
                  Confirm
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="visualization">
            <Activity className="h-4 w-4 mr-2" />
            Track Visualization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <TrackingGrid
            loadId={loadId}
            load={load}
            vehicleGPS={vehicleGPS}
            trackingLoading={trackingLoading}
            latestTracking={latestTracking}
            currentEta={currentEta}
            isConnected={isConnected}
            syncState={syncState}
            isTracking={isTracking}
          />

          <RecentEventsSection events={events} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Predictive ETA Card */}
            {syncState?.predictiveETA && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Predictive ETA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Arrival</p>
                    <p className="text-3xl font-bold">
                      {syncState.predictiveETA.estimatedArrival.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Confidence</p>
                      <p className="font-semibold">
                        {(syncState.predictiveETA.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Optimistic</p>
                      <p className="font-semibold">
                        {syncState.predictiveETA.alternativeETAs.optimistic.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-2">Factors:</p>
                    <div className="space-y-1 text-xs">
                      <FactorBar label="Historical Speed" value={syncState.predictiveETA.factors.historicalSpeed} />
                      <FactorBar label="Traffic" value={syncState.predictiveETA.factors.currentTraffic} />
                      <FactorBar label="Weather" value={syncState.predictiveETA.factors.weatherImpact} />
                      <FactorBar label="Driver Behavior" value={syncState.predictiveETA.factors.driverBehavior} />
                      <FactorBar label="Route Complexity" value={syncState.predictiveETA.factors.routeComplexity} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tracking Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Integration Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Wialon Tracking</span>
                  <Badge variant={isTracking ? 'default' : 'secondary'}>
                    {isTracking ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-Sync</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={syncState?.autoSyncEnabled ? 'default' : 'secondary'}>
                      {syncState?.autoSyncEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={toggleAutoSync}>
                      {syncState?.autoSyncEnabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
                {syncState?.currentLocation && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Current Position</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Speed:</span>{' '}
                        <span className="font-semibold">{syncState.currentLocation.speed.toFixed(1)} km/h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Heading:</span>{' '}
                        <span className="font-semibold">{syncState.currentLocation.heading.toFixed(0)}°</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visualization" className="mt-6">
          {load.assigned_vehicle && mappedVehicle && (
            <EnhancedTrackVisualization
              vehicleId={mappedVehicle.id}
              vehicleName={Array.isArray(load.assigned_vehicle) ? load.assigned_vehicle[0]?.name : load.assigned_vehicle.name}
              startTime={new Date(load.pickup_datetime)}
              endTime={load.actual_delivery_datetime ? new Date(load.actual_delivery_datetime) : new Date()}
              plannedRoute={syncState?.plannedRoute}
              showHeatmap={true}
              showSpeedProfile={true}
              showAnalytics={true}
            />
          )}
          {load.assigned_vehicle && !mappedVehicle && (
            <Card className="p-6">
              <CardContent className="text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Vehicle Mapping Required</p>
                <p className="text-sm text-muted-foreground">
                  This Wialon vehicle needs to be linked to your fleet vehicles table.
                  Contact your administrator to configure the vehicle mapping.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <EnhancedProgressDashboard loadId={loadId} />
    </div>
  );
};

// Custom Hooks
const useLoadQuery = (loadId: string) => {
  return useQuery({
    queryKey: ["load", loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loads")
        .select(`
          *,
          assigned_vehicle:wialon_vehicles!fk_assigned_vehicle(
            id,
            wialon_unit_id,
            name,
            registration
          )
        `)
        .eq("id", loadId)
        .single();

      if (error) throw error;
      return data as Load;
    },
  });
};

const useMappedVehicleQuery = (wialonUnitId?: number) => {
  return useQuery({
    queryKey: ["mapped-vehicle", wialonUnitId],
    queryFn: async () => {
      if (!wialonUnitId) return null;

      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number")
        .eq("wialon_id", wialonUnitId)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ vehicle mapping error:", error);
        return null;
      }
      return data;
    },
    enabled: !!wialonUnitId,
  });
};

const useTrackingQuery = (loadId: string, autoRefresh: boolean) => {
  return useQuery({
    queryKey: ["delivery-tracking-latest", loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_tracking")
        .select("*")
        .eq("load_id", loadId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code !== "PGRST116" && error.code !== "406") {
          console.warn("⚠️ delivery_tracking error:", error);
        }
        return null;
      }
      return data as DeliveryTracking | null;
    },
    refetchInterval: autoRefresh ? REFRESH_INTERVAL : false,
    retry: false,
  });
};

const useEventsQuery = (loadId: string) => {
  return useQuery({
    queryKey: ["delivery-events", loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_events")
        .select("*")
        .eq("load_id", loadId)
        .order("event_timestamp", { ascending: false });

      if (error) {
        if (error.code !== "406") {
          console.warn("⚠️ delivery_events error:", error);
        }
        return [];
      }
      return data as DeliveryEvent[];
    },
    retry: false,
  });
};

const useETAQuery = (loadId: string) => {
  return useQuery({
    queryKey: ["delivery-eta", loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_eta")
        .select("*")
        .eq("load_id", loadId)
        .eq("is_current", true)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code !== "PGRST116" && error.code !== "406") {
          console.warn("⚠️ delivery_eta error:", error);
        }
        return null;
      }
      return data as DeliveryEta | null;
    },
    retry: false,
  });
};

// Utility Functions
const isTrackingTablesError = (error: unknown): boolean => {
  const isPostgrestError = (err: unknown): err is PostgrestError => {
    return err !== null && typeof err === 'object' && 'code' in err;
  };

  return error && (
    (error as Error).message?.includes('does not exist') ||
    (isPostgrestError(error) && error.code === '42P01')
  );
};

const calculateEcoScore = (speed?: number): number => {
  if (!speed || speed === 0) return 85;
  return Math.max(0, 100 - Math.max(0, speed - ECO_DRIVING_THRESHOLDS.SPEED_PENALTY_START) * ECO_DRIVING_THRESHOLDS.SPEED_PENALTY_MULTIPLIER);
};

const getSpeedStatus = (speed?: number) => {
  if (!speed) return { color: 'text-green-600', label: 'Normal' };
  if (speed > SPEED_THRESHOLDS.DANGEROUS_SPEED) return { color: 'text-red-600', label: 'High Speed' };
  if (speed > SPEED_THRESHOLDS.HIGH_SPEED) return { color: 'text-yellow-600', label: 'High Speed' };
  return { color: 'text-green-600', label: 'Normal' };
};

const isSignalFresh = (timestamp?: Date): boolean => {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < SIGNAL_QUALITY_THRESHOLD;
};

// Component Sections
interface TrackingHeaderProps {
  load: Load;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
}

const TrackingHeader = ({ load, autoRefresh, onToggleAutoRefresh, onRefresh }: TrackingHeaderProps) => (
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-2xl font-bold">Live Tracking</h2>
      <p className="text-muted-foreground">
        Load #{load.load_number} - {load.customer_name} - {load.origin} → {load.destination}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <LoadRealtimeIndicator />
      <Badge variant={autoRefresh ? "default" : "secondary"}>
        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
      </Badge>
      <Button size="sm" variant="outline" onClick={onToggleAutoRefresh}>
        {autoRefresh ? "Pause" : "Resume"}
      </Button>
      <Button size="sm" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  </div>
);

interface TrackingGridProps {
  loadId: string;
  load: Load;
  vehicleGPS: VehicleLocation | null;
  trackingLoading: boolean;
  latestTracking: DeliveryTracking | null;
  currentEta: DeliveryEta | null;
  isConnected: boolean;
  syncState?: LoadWialonSync | null;
  isTracking?: boolean;
}

const TrackingGrid = ({
  loadId,
  load,
  vehicleGPS,
  trackingLoading,
  latestTracking,
  currentEta,
  isConnected,
  syncState,
  isTracking: _isTracking
}: TrackingGridProps) => {
  // Calculate route progress using Phase 1 RouteGeometryService
  const routeProgress = useMemo(() => {
    if (!vehicleGPS || !syncState?.plannedRoute || syncState.plannedRoute.length < 2) {
      return null;
    }

    try {
      const vehiclePos = new LatLng(vehicleGPS.latitude, vehicleGPS.longitude);
      const routeCoords = syncState.plannedRoute.map(wp => new LatLng(wp.lat, wp.lng));

      // Calculate total distance
      const totalDistance = routeGeometry.calculateRouteDistance(routeCoords);

      // Find closest point on route
      const closest = routeGeometry.findClosestPointOnRoute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any, // Map instance - using distance calculations only
        vehiclePos,
        routeCoords
      );

      if (!closest) return null;

      // Calculate distance traveled (rough estimate based on closest point)
      const startToClosest = routeCoords.slice(0, routeCoords.findIndex(p =>
        p.lat === closest.point.lat && p.lng === closest.point.lng
      ) + 1);
      const distanceTraveled = startToClosest.length > 0
        ? routeGeometry.calculateRouteDistance(startToClosest)
        : 0;

      const progress = (distanceTraveled / totalDistance) * 100;
      const remaining = totalDistance - distanceTraveled;

      return {
        progress: Math.min(100, Math.max(0, progress)),
        totalDistance: routeGeometry.formatDistance(totalDistance),
        distanceTraveled: routeGeometry.formatDistance(distanceTraveled),
        distanceRemaining: routeGeometry.formatDistance(remaining),
        deviation: closest.distance,
        isOffRoute: closest.distance > 500 // 500m threshold
      };
    } catch (error) {
      console.error('Error calculating route progress:', error);
      return null;
    }
  }, [vehicleGPS, syncState?.plannedRoute]);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <LoadStatusWorkflow
          loadId={loadId}
          currentStatus={load.status as LoadStatus}
          loadNumber={load.load_number}
        />
      </div>

      <div className="lg:col-span-1">
        <LoadUpdateTimeline loadId={loadId} />
      </div>

      <CurrentPositionCard
        vehicleGPS={vehicleGPS}
        load={load}
        trackingLoading={trackingLoading}
        latestTracking={latestTracking}
        isConnected={isConnected}
      />

      {routeProgress && (
        <RouteProgressCard progress={routeProgress} />
      )}

      <ETACard currentEta={currentEta} />
      <ProgressCard latestTracking={latestTracking} />
      <EcoDrivingCard vehicleGPS={vehicleGPS} latestTracking={latestTracking} />
    </div>
  );
};

interface TrackingNotConfiguredCardProps {
  load: Load;
}

const TrackingNotConfiguredCard = ({ load }: TrackingNotConfiguredCardProps) => (
  <Card className="p-8">
    <CardContent className="text-center space-y-4">
      <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto" />
      <h3 className="text-xl font-bold">GPS Tracking Not Configured</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        The GPS tracking database tables haven't been created yet. Apply the database migration to enable real-time tracking.
      </p>
      <div className="bg-gray-50 p-4 rounded-lg text-left max-w-2xl mx-auto">
        <p className="text-sm font-medium mb-2">To enable tracking, run this SQL in Supabase:</p>
        <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
          See APPLY_MIGRATION_NOW.md for the full SQL script
        </code>
      </div>
      <div className="pt-4">
        <p className="text-sm text-muted-foreground">
          <strong>Load Details:</strong><br />
          {load.load_number} - {load.customer_name}<br />
          {load.origin} → {load.destination}<br />
          Status: {load.status}
        </p>
      </div>
    </CardContent>
  </Card>
);

const CurrentPositionCard = ({ vehicleGPS, load, trackingLoading, latestTracking, isConnected }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Current Position
      </CardTitle>
    </CardHeader>
    <CardContent>
      {trackingLoading ? (
        <LoadingIndicator />
      ) : vehicleGPS ? (
        <LiveGPSDisplay vehicleGPS={vehicleGPS} load={load} />
      ) : latestTracking ? (
        <FallbackToLatestTracking latestTracking={latestTracking} />
      ) : !load.assigned_vehicle_id ? (
        <NoVehicleAssigned />
      ) : !isConnected ? (
        <GPSNotConnected />
      ) : (
        <NoTrackingDataAvailable />
      )}
    </CardContent>
  </Card>
);

const LiveGPSDisplay = ({ vehicleGPS, load }) => {
  const speedStatus = getSpeedStatus(vehicleGPS.speed);
  const signalFresh = isSignalFresh(vehicleGPS.timestamp);

  return (
    <div className="space-y-3">
      <div className="mb-2">
        <Badge variant="default" className="bg-green-500">
          <Navigation className="h-3 w-3 mr-1" />
          Live GPS Active
        </Badge>
      </div>

      <CoordinateGrid vehicleGPS={vehicleGPS} />
      <SpeedAndVehicleGrid vehicleGPS={vehicleGPS} load={load} speedStatus={speedStatus} />
      <SignalQualitySection vehicleGPS={vehicleGPS} signalFresh={signalFresh} />
    </div>
  );
};

const CoordinateGrid = ({ vehicleGPS }) => (
  <div className="grid grid-cols-2 gap-3 text-sm">
    <CoordinateCard label="Latitude" value={vehicleGPS.latitude?.toFixed(6) || 'N/A'} />
    <CoordinateCard label="Longitude" value={vehicleGPS.longitude?.toFixed(6) || 'N/A'} />
  </div>
);

const CoordinateCard = ({ label, value }) => (
  <div className="p-2 bg-blue-50 rounded-lg">
    <p className="text-blue-700 font-medium">{label}</p>
    <p className="font-mono text-blue-900">{value}</p>
  </div>
);

const SpeedAndVehicleGrid = ({ vehicleGPS, load, speedStatus }) => (
  <div className="grid grid-cols-2 gap-3 text-sm">
    <SpeedCard vehicleGPS={vehicleGPS} speedStatus={speedStatus} />
    <VehicleCard load={load} />
  </div>
);

const SpeedCard = ({ vehicleGPS, speedStatus }) => (
  <div className="p-2 bg-green-50 rounded-lg border border-green-200">
    <p className="text-green-700 font-medium">Speed</p>
    <p className="font-bold text-green-900">
      {(vehicleGPS.speed || 0).toFixed(0)} km/h
    </p>
    <Badge
      variant={(vehicleGPS.speed || 0) > SPEED_THRESHOLDS.HIGH_SPEED ? "destructive" : "default"}
      className="text-xs mt-1"
    >
      {speedStatus.label}
    </Badge>
  </div>
);

const VehicleCard = ({ load }) => (
  <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
    <p className="text-purple-700 font-medium">Vehicle</p>
    <p className="font-bold text-purple-900 text-xs">{load.assigned_vehicle?.name}</p>
    <Badge variant="outline" className="text-xs mt-1">
      {load.assigned_vehicle?.registration || 'N/A'}
    </Badge>
  </div>
);

const SignalQualitySection = ({ vehicleGPS, signalFresh }) => (
  <div className="pt-3 border-t border-gray-200">
    <div className="flex justify-between items-center mb-2">
      <p className="text-xs text-muted-foreground">
        📡 Last update: {vehicleGPS.timestamp ? formatDistanceToNow(vehicleGPS.timestamp, { addSuffix: true }) : 'Unknown'}
      </p>
      <div className={`w-3 h-3 rounded-full ${signalFresh ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
    </div>

    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">Signal Quality:</span>
      <Badge variant="outline" className="text-xs">
        {signalFresh ? 'Excellent' : 'Poor'}
      </Badge>
    </div>
  </div>
);

const ETACard = ({ currentEta }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Clock className="h-5 w-5" />
        Estimated Arrival
      </CardTitle>
    </CardHeader>
    <CardContent>
      {currentEta ? (
        <ETAInformation eta={currentEta} />
      ) : (
        <NoDataMessage message="ETA not available" />
      )}
    </CardContent>
  </Card>
);

const ProgressCard = ({ latestTracking }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Navigation className="h-5 w-5" />
        Progress
      </CardTitle>
    </CardHeader>
    <CardContent>
      {latestTracking ? (
        <ProgressInformation tracking={latestTracking} />
      ) : (
        <NoDataMessage message="No distance data" />
      )}
    </CardContent>
  </Card>
);

const EcoDrivingCard = ({ vehicleGPS, latestTracking }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-green-600" />
        Eco-Driving Score
      </CardTitle>
    </CardHeader>
    <CardContent>
      {vehicleGPS || latestTracking ? (
        <EcoDrivingPerformance vehicleGPS={vehicleGPS} latestTracking={latestTracking} />
      ) : (
        <NoDataMessage message="No performance data" />
      )}
    </CardContent>
  </Card>
);

const RecentEventsSection = ({ events }) => (
  <div className="grid gap-6">
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <RecentEvents events={events} />
        ) : (
          <NoDataMessage message="No events recorded yet" />
        )}
      </CardContent>
    </Card>
  </div>
);

// Factor Bar Component for ETA Factors
const FactorBar = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-mono">{value.toFixed(1)}</span>
    </div>
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all"
        style={{ width: `${Math.min(100, (value / 120) * 100)}%` }}
      />
    </div>
  </div>
);

// Utility Components
const LoadingIndicator = () => (
  <p className="text-sm text-muted-foreground">Loading...</p>
);

const NoDataMessage = ({ message }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <AlertCircle className="h-4 w-4" />
    {message}
  </div>
);

const NoTrackingDataAvailable = () => (
  <NoDataMessage message="No tracking data available" />
);

// Existing components (unchanged)
const FallbackToLatestTracking = ({ latestTracking }: { latestTracking: DeliveryTracking }) => (
  <div className="space-y-2">
    <p className="text-muted-foreground">Fallback GPS Data:</p>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-muted-foreground">Latitude</p>
        <p className="font-mono">{latestTracking.latitude?.toFixed(6) || 'N/A'}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Longitude</p>
        <p className="font-mono">{latestTracking.longitude?.toFixed(6) || 'N/A'}</p>
      </div>
    </div>
  </div>
);

const NoVehicleAssigned = () => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm text-yellow-600">
      <AlertCircle className="h-4 w-4" />
      No vehicle assigned to this load
    </div>
    <p className="text-xs text-muted-foreground">
      Assign a Wialon-tracked vehicle to enable live GPS tracking.
    </p>
  </div>
);

const GPSNotConnected = () => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm text-yellow-600">
      <AlertCircle className="h-4 w-4" />
      GPS system not connected
    </div>
    <p className="text-xs text-muted-foreground">
      Connecting to Wialon GPS system...
    </p>
  </div>
);

const ETAInformation = ({ eta }: { eta: DeliveryEta }) => (
  <div className="space-y-3">
    <div>
      <p className="text-2xl font-bold">
        {new Date(eta.estimated_arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="text-sm text-muted-foreground">{new Date(eta.estimated_arrival).toLocaleDateString()}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
      <div>
        <p className="text-muted-foreground">Remaining</p>
        <p className="font-semibold">{eta.remaining_distance_km?.toFixed(1)} km</p>
      </div>
      <div>
        <p className="text-muted-foreground">Avg Speed</p>
        <p className="font-semibold">{eta.average_speed_kmh?.toFixed(0)} km/h</p>
      </div>
    </div>
    <div className="pt-2 border-t">
      <p className="text-xs text-muted-foreground">Confidence: {((eta.confidence_level || 0) * 100).toFixed(0)}%</p>
    </div>
  </div>
);

const ProgressInformation = ({ tracking }: { tracking: DeliveryTracking }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <p className="text-muted-foreground">From Origin</p>
        <p className="font-semibold">{tracking.distance_from_origin_km?.toFixed(1) || "N/A"} km</p>
      </div>
      <div>
        <p className="text-muted-foreground">To Destination</p>
        <p className="font-semibold">{tracking.distance_to_destination_km?.toFixed(1) || "N/A"} km</p>
      </div>
    </div>
    <div className="pt-2 border-t">
      <p className="text-muted-foreground text-sm">Total Traveled</p>
      <p className="text-2xl font-bold">
        {tracking.distance_traveled_km?.toFixed(1) || "0.0"} km
      </p>
    </div>
    {tracking.idle_duration_minutes > 0 && (
      <div className="pt-2 border-t">
        <Badge variant="secondary">Idle: {tracking.idle_duration_minutes} min</Badge>
      </div>
    )}
  </div>
);

const EcoDrivingPerformance = ({ vehicleGPS, latestTracking }: { vehicleGPS: VehicleLocation | null; latestTracking: DeliveryTracking }) => {
  const ecoScore = calculateEcoScore(vehicleGPS?.speed);
  const speedStatus = getSpeedStatus(vehicleGPS?.speed);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className={`text-3xl font-bold ${speedStatus.color}`}>
          {ecoScore.toFixed(0)}
        </div>
        <p className="text-sm text-muted-foreground">Current Eco Score</p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current Speed</span>
          <span className={`font-semibold ${speedStatus.color}`}>
            {vehicleGPS?.speed?.toFixed(0) || latestTracking?.speed?.toFixed(0) || '0'} km/h
          </span>
        </div>
      </div>
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">Environmental alerts based on speed and idling times.</p>
        {vehicleGPS?.speed && vehicleGPS.speed > SPEED_THRESHOLDS.DANGEROUS_SPEED && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            ⚠️ Speed too high - risk of poor fuel efficiency.
          </p>
        )}
        {latestTracking?.idle_duration_minutes && latestTracking.idle_duration_minutes > ECO_DRIVING_THRESHOLDS.IDLE_WARNING && (
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            🔶 High idle time detected - consider turning off engine during long stops
          </p>
        )}
      </div>
    </div>
  );
};

const getEventIcon = (eventType: string) => {
  const icons: Record<string, string> = {
    'load_assigned': '📦',
    'load_started': '🚀',
    'arrived_pickup': '📍',
    'loading_started': '⏳',
    'loading_completed': '✅',
    'departed_pickup': '🚚',
    'arrived_delivery': '🏁',
    'offloading_started': '📤',
    'offloading_completed': '✔️',
    'load_completed': '🎉',
    'load_cancelled': '❌',
  };
  return icons[eventType] || '📝';
};

const RecentEvents = ({ events }: { events: DeliveryEvent[] }) => (
  <div className="space-y-3">
    {events.map((event) => (
      <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
        <div className="text-2xl">{getEventIcon(event.event_type)}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-semibold capitalize">{event.event_type.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.event_timestamp), { addSuffix: true })}
            </p>
          </div>
          {event.location_name && (
            <p className="text-sm text-muted-foreground">{event.location_name}</p>
          )}
          {event.description && (
            <p className="text-sm mt-1">{event.description}</p>
          )}
          {event.notes && (
            <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>
          )}
        </div>
      </div>
    ))}
  </div>
);

// RouteProgressCard Component - Phase 1 Integration
interface RouteProgressCardProps {
  progress: {
    progress: number;
    totalDistance: string;
    distanceTraveled: string;
    distanceRemaining: string;
    deviation: number;
    isOffRoute: boolean;
  };
}

const RouteProgressCard = ({ progress }: RouteProgressCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5" />
        Route Progress
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold">{progress.progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress.progress} className="h-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-2 bg-blue-50 rounded-lg">
          <p className="text-blue-700 font-medium">Traveled</p>
          <p className="font-bold text-blue-900">{progress.distanceTraveled}</p>
        </div>
        <div className="p-2 bg-green-50 rounded-lg">
          <p className="text-green-700 font-medium">Remaining</p>
          <p className="font-bold text-green-900">{progress.distanceRemaining}</p>
        </div>
      </div>

      <div className="p-2 bg-gray-50 rounded-lg">
        <p className="text-gray-700 font-medium text-sm">Total Distance</p>
        <p className="font-bold text-gray-900">{progress.totalDistance}</p>
      </div>

      {progress.isOffRoute && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-red-700 font-medium text-sm">Off Route</p>
              <p className="text-red-600 text-xs">
                {progress.deviation.toFixed(0)}m from planned route
              </p>
            </div>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
