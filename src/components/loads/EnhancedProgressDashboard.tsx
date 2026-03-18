// src/components/loads/EnhancedProgressDashboard.tsx

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { Activity, AlertTriangle, CheckCircle2, Clock, MapPin, Package, TrendingUp } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";

// Fix for default Leaflet icons in React
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface EnhancedProgressDashboardProps {
  loadId: string;
}

// Define expected shapes from related tables
interface DeliveryTracking {
  id: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  distance_to_destination_km?: number | null;
  recorded_at: string;
}

interface DeliveryETA {
  estimated_arrival: string;
  remaining_distance_km?: number | null;
  confidence_level?: number | null;
  calculated_at: string;
}

interface DeliveryEvent {
  id: string;
  event_type: string;
  description?: string | null;
  event_timestamp: string;
}

interface LoadWithRelations {
  id: string;
  status: string;
  assigned_at?: string | null;
  arrived_at_pickup?: string | null;
  loading_completed_at?: string | null;
  actual_pickup_datetime?: string | null;
  arrived_at_delivery?: string | null;
  offloading_completed_at?: string | null;
  delivered_at?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;

  // Relations
  delivery_tracking: DeliveryTracking[];
  delivery_eta: DeliveryETA[];
  delivery_events: DeliveryEvent[];
}

interface Milestone {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "pending" | "delayed";
  completedAt?: Date;
  estimatedAt?: Date;
}

interface LoadProgress {
  percentage: number;
  currentPhase: string;
  phasesCompleted: number;
  totalPhases: number;
  estimatedCompletion: Date | null;
  delays: number;
  milestones: Milestone[];
}

const mapContainerStyle = {
  height: "400px",
  width: "100%",
};

export const EnhancedProgressDashboard = ({ loadId }: EnhancedProgressDashboardProps) => {
  const { data: load, refetch } = useQuery({
    queryKey: ["load-progress", loadId],
    queryFn: async (): Promise<LoadWithRelations | null> => {
      const { data, error } = await supabase
        .from("loads")
        .select(`
          id,
          status,
          assigned_at,
          arrived_at_pickup,
          loading_completed_at,
          actual_pickup_datetime,
          arrived_at_delivery,
          offloading_completed_at,
          delivered_at,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          delivery_tracking!delivery_tracking_load_id_fkey (
            id,
            latitude,
            longitude,
            speed,
            distance_to_destination_km,
            recorded_at
          ),
          delivery_eta!delivery_eta_load_id_fkey (
            estimated_arrival,
            remaining_distance_km,
            confidence_level,
            calculated_at
          ),
          delivery_events!delivery_events_load_id_fkey (
            id,
            event_type,
            description,
            event_timestamp
          )
        `)
        .eq("id", loadId)
        .order("recorded_at", { foreignTable: "delivery_tracking", ascending: false })
        .order("calculated_at", { foreignTable: "delivery_eta", ascending: false })
        .order("event_timestamp", { foreignTable: "delivery_events", ascending: false })
        .maybeSingle();

      if (error) throw error;
      return data as LoadWithRelations | null;
    },
    refetchInterval: 30000,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`load-progress-${loadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads", filter: `id=eq.${loadId}` },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_tracking", filter: `load_id=eq.${loadId}` },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_eta", filter: `load_id=eq.${loadId}` },
        () => refetch()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_events", filter: `load_id=eq.${loadId}` },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, refetch]);

  const progress = useMemo((): LoadProgress => {
    if (!load)
      return {
        percentage: 0,
        currentPhase: "Pending",
        phasesCompleted: 0,
        totalPhases: 7,
        estimatedCompletion: null,
        delays: 0,
        milestones: [],
      };

    const phases = [
      { name: "Assigned", field: "assigned_at" },
      { name: "Arrived at Pickup", field: "arrived_at_pickup" },
      { name: "Loading Complete", field: "loading_completed_at" },
      { name: "In Transit", field: "actual_pickup_datetime" },
      { name: "Arrived at Delivery", field: "arrived_at_delivery" },
      { name: "Offloading Complete", field: "offloading_completed_at" },
      { name: "Delivered", field: "delivered_at" },
    ] as const;

    const milestones: Milestone[] = phases.map((phase, index) => {
      const value = load[phase.field];
      const isCompleted = value != null;
      const isCurrent = load.status.toLowerCase().includes(phase.name.toLowerCase().replace(/ /g, "_"));

      return {
        id: `milestone-${index}`,
        name: phase.name,
        status: isCompleted ? "completed" : isCurrent ? "in_progress" : "pending",
        completedAt: value ? new Date(value as string) : undefined,
      };
    });

    const completedCount = milestones.filter((m) => m.status === "completed").length;
    const percentage = (completedCount / phases.length) * 100;

    const latestETA = load.delivery_eta?.[0]?.estimated_arrival
      ? new Date(load.delivery_eta[0].estimated_arrival)
      : null;

    return {
      percentage,
      currentPhase: load.status,
      phasesCompleted: completedCount,
      totalPhases: phases.length,
      estimatedCompletion: latestETA,
      delays: 0, // Can be enhanced later
      milestones,
    };
  }, [load]);

  const mapCenter: [number, number] = useMemo(() => {
    const currentLat = load?.delivery_tracking?.[0]?.latitude;
    const currentLng = load?.delivery_tracking?.[0]?.longitude;
    if (currentLat != null && currentLng != null) {
      return [currentLat, currentLng];
    }
    const originLat = load?.origin_lat;
    const originLng = load?.origin_lng;
    if (originLat != null && originLng != null) {
      return [originLat, originLng];
    }
    return [0, 0];
  }, [load]);

  const routePath = useMemo(() => {
    const path: [number, number][] = [];
    if (load?.origin_lat != null && load?.origin_lng != null) {
      path.push([load.origin_lat, load.origin_lng]);
    }
    if (load?.destination_lat != null && load?.destination_lng != null) {
      path.push([load.destination_lat, load.destination_lng]);
    }
    return path;
  }, [load]);

  if (!load) {
    return <div className="text-center py-8">Loading progress...</div>;
  }

  const latestTracking = load.delivery_tracking?.[0];
  const latestETA = load.delivery_eta?.[0];

  return (
    <div className="space-y-6">
      {/* Overall Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Delivery Progress</CardTitle>
            <Badge variant={progress.percentage === 100 ? "default" : "secondary"}>
              {progress.percentage.toFixed(0)}% Complete
            </Badge>
          </div>
          <Progress value={progress.percentage} className="mt-4" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-sm text-muted-foreground">Phase</p>
              <p className="text-lg font-bold">
                {progress.phasesCompleted}/{progress.totalPhases}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-sm text-muted-foreground">ETA</p>
              <p className="text-lg font-bold">
                {progress.estimatedCompletion
                  ? progress.estimatedCompletion.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "TBD"}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-600" />
              <p className="text-sm text-muted-foreground">Delays</p>
              <p className="text-lg font-bold">{progress.delays}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {progress.milestones.map((milestone, index) => (
              <div key={milestone.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                      ${milestone.status === "completed" ? "bg-green-500" : ""}
                      ${milestone.status === "in_progress" ? "bg-blue-500 animate-pulse" : ""}
                      ${milestone.status === "pending" ? "bg-gray-300 text-gray-600" : ""}
                    `}
                  >
                    {milestone.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                  </div>
                  {index < progress.milestones.length - 1 && (
                    <div
                      className={`w-0.5 h-16 mt-2 ${
                        milestone.status === "completed" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>

                <div className="flex-1 pb-8">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{milestone.name}</h4>
                    <Badge
                      variant={
                        milestone.status === "completed"
                          ? "default"
                          : milestone.status === "in_progress"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {milestone.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {milestone.completedAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Completed: {milestone.completedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestETA && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Distance Remaining</span>
                    <span className="font-semibold">
                      {latestETA.remaining_distance_km?.toFixed(1) ?? "—"} km
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">ETA Confidence</span>
                    <span className="font-semibold">
                      {latestETA.confidence_level != null ? `${(latestETA.confidence_level * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </>
              )}
              {latestTracking && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Speed</span>
                    <span className="font-semibold">
                      {latestTracking.speed?.toFixed(0) ?? "—"} km/h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Distance to Destination</span>
                    <span className="font-semibold">
                      {latestTracking.distance_to_destination_km?.toFixed(1) ?? "—"} km
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Current Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestTracking ? (
                <div className="space-y-2 font-mono text-sm">
                  <p>
                    <span className="text-muted-foreground">Lat:</span>{" "}
                    {latestTracking.latitude.toFixed(6)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Lng:</span>{" "}
                    {latestTracking.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {new Date(latestTracking.recorded_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No location data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Route Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MapContainer
                center={mapCenter}
                zoom={10}
                style={mapContainerStyle}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* Origin Marker */}
                {load.origin_lat != null && load.origin_lng != null && (
                  <Marker position={[load.origin_lat, load.origin_lng]}>
                    <Popup>Origin</Popup>
                  </Marker>
                )}

                {/* Current Position Marker */}
                {latestTracking && (
                  <Marker position={[latestTracking.latitude, latestTracking.longitude]}>
                    <Popup>Current Position</Popup>
                  </Marker>
                )}

                {/* Destination Marker */}
                {load.destination_lat != null && load.destination_lng != null && (
                  <Marker position={[load.destination_lat, load.destination_lng]}>
                    <Popup>Destination</Popup>
                  </Marker>
                )}

                {/* Route Polyline */}
                {routePath.length > 1 && (
                  <Polyline
                    pathOptions={{ color: "red", weight: 3, opacity: 0.8 }}
                    positions={routePath}
                  />
                )}
              </MapContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              {load.delivery_events && load.delivery_events.length > 0 ? (
                <div className="space-y-3">
                  {load.delivery_events.slice(0, 7).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Activity className="h-4 w-4 mt-0.5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-sm capitalize">{event.event_type.replace(/_/g, " ")}</p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.event_timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No events recorded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedProgressDashboard;
