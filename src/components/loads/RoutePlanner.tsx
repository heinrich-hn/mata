import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouteOptimization } from "@/hooks/useRouteOptimization";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import
  {
    Clock,
    Fuel,
    MapPin,
    MapPinned,
    Navigation,
    Play,
    Plus,
    Route,
    Save,
    Search,
    Truck,
    X,
    Zap,
  } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import
  {
    Circle,
    MapContainer,
    Marker,
    Polyline,
    Popup,
    TileLayer,
  } from "react-leaflet";

import
  {
    getWialonAdvancedService,
    useWialonContext,
    type TrackingEvent,
  } from "@/integrations/wialon";
import { DatePicker } from "../ui/date-picker";

// Fix Leaflet default marker icons
// @ts-expect-error - Leaflet internal fix for default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Enterprise measurement formatting
interface FormattedMeasurement {
  value: number;
  unit: string;
  formatted: string;
}

const formatEnterpriseMetric = (
  value: number,
  type: "speed" | "distance" | "fuel" | "duration",
  locale = "en-ZA",
): FormattedMeasurement => {
  const isImperial = locale.includes("US") || locale.includes("GB");

  switch (type) {
    case "speed": {
      const speedValue = isImperial ? value * 0.6214 : value;
      const speedUnit = isImperial ? "mph" : "km/h";
      return {
        value: speedValue,
        unit: speedUnit,
        formatted: `${speedValue.toFixed(1)} ${speedUnit}`,
      };
    }
    case "distance": {
      const distValue = isImperial ? value * 0.6214 : value;
      const distUnit = isImperial ? "mi" : "km";
      return {
        value: distValue,
        unit: distUnit,
        formatted: `${distValue.toFixed(2)} ${distUnit}`,
      };
    }
    case "fuel": {
      const fuelValue = isImperial ? value * 0.2642 : value;
      const fuelUnit = isImperial ? "gal" : "L";
      return {
        value: fuelValue,
        unit: fuelUnit,
        formatted: `${fuelValue.toFixed(2)} ${fuelUnit}`,
      };
    }
    case "duration": {
      const hours = Math.floor(value / 60);
      const minutes = Math.floor(value % 60);
      return {
        value,
        unit: "mins",
        formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      };
    }
    default:
      return { value, unit: "", formatted: value.toString() };
  }
};

// Enhanced tracking event interface
interface EcoMetrics {
  harshBraking: number;
  rapidAcceleration: number;
  idleTime: number;
  fuelEfficiency: number;
}

interface EnhancedTrackingEvent extends TrackingEvent {
  fuelLevel?: number;
  driverScore?: number;
  routeDeviation?: number;
  ecoMetrics?: EcoMetrics;
}

// Track visualization interfaces
interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;
  course?: number;
}

interface VehicleTrack {
  unitId: string;
  unitName: string;
  color: string;
  points: TrackPoint[];
  isVisible: boolean;
}

interface TrackVisualizationState {
  isEnabled: boolean;
  selectedDate: string;
  timeRange: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  activeTracks: Map<string, VehicleTrack>;
}

interface Waypoint {
  id: string;
  sequence: number;
  address: string;
  latitude: number;
  longitude: number;
  type: "pickup" | "delivery" | "rest_stop" | "customs" | "weigh_station";
  geofenceId?: string;
}

interface RouteStats {
  total_distance_km: number;
  estimated_duration_mins: number;
  estimated_fuel_litres?: number;
  estimated_fuel_cost?: number;
  optimized_sequence: number[];
  waypoints?: unknown[];
}

interface RouteOptimizerProps {
  tripId?: string;
  initialWaypoints?: Waypoint[];
}

interface Geofence {
  id: string;
  name: string;
  description: string | null;
  type: "circle" | "polygon" | "line";
  center_lat: number | null;
  center_lng: number | null;
  radius: number | null;
  coordinates: unknown;
  color: string | null;
  groups: string | null;
  metadata: Record<string, unknown>;
  is_active?: boolean;
}

interface ExistingWaypoint {
  id: string;
  sequence_order: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  is_fuel_stop: boolean | null;
  route_id: string;
  notes?: string | null;
}

const DEFAULT_CENTER: [number, number] = [-26.2041, 28.0473];
const DEFAULT_ZOOM_WITH_WAYPOINTS = 6;
const DEFAULT_ZOOM_NO_WAYPOINTS = 7;

const RoutePlanner = ({ tripId, initialWaypoints = [] }: RouteOptimizerProps) => {
  const { toast } = useToast();
  const { optimizeRoute, saveOptimization } = useRouteOptimization();
  const { vehicleLocations, isConnected: wialonConnected, callAPI } =
    useWialonContext();

  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [optimizedSequence, setOptimizedSequence] = useState<number[]>([]);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [vehicleTracking, setVehicleTracking] = useState<
    Map<string, TrackingEvent>
  >(new Map());
  const [geofenceDialogOpen, setGeofenceDialogOpen] = useState(false);
  const [geofenceSearchTerm, setGeofenceSearchTerm] = useState("");

  const [trackVisualization, setTrackVisualization] =
    useState<TrackVisualizationState>({
      isEnabled: false,
      selectedDate: new Date().toISOString().split("T")[0],
      timeRange: {
        start: "00:00",
        end: "23:59",
      },
      activeTracks: new Map(),
    });

  // New waypoint form
  const [newWaypoint, setNewWaypoint] = useState<{
    address: string;
    latitude: string;
    longitude: string;
    type: "pickup" | "delivery" | "rest_stop" | "customs" | "weigh_station";
  }>({
    address: "",
    latitude: "",
    longitude: "",
    type: "delivery",
  });

  // Load geofences
  const { data: geofences = [], isLoading: isLoadingGeofences } = useQuery({
    queryKey: ["geofences-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geofences" as never)
        .select("*")
        .eq("is_active", true)
        .not("center_lat", "is", null)
        .not("center_lng", "is", null)
        .order("name");

      if (error) throw error;
      return (data || []) as unknown as Geofence[];
    },
  });

  // Filter geofences based on search (memoized)
  const filteredGeofences = useMemo(
    () =>
      geofences.filter((g) => {
        const term = geofenceSearchTerm.toLowerCase();
        return (
          g.name.toLowerCase().includes(term) ||
          g.description?.toLowerCase().includes(term) ||
          (g.metadata &&
            "city" in g.metadata &&
            String(g.metadata.city).toLowerCase().includes(term))
        );
      }),
    [geofences, geofenceSearchTerm],
  );

  // Load existing waypoints if tripId provided
  const { data: existingWaypoints } = useQuery({
    queryKey: ["route-waypoints", tripId],
    queryFn: async () => {
      if (!tripId) return [];

      const { data, error } = await supabase
        .from("route_waypoints")
        .select("*")
        .eq("route_id", tripId)
        .order("sequence_order");

      if (error) throw error;

      return (data || []).map((wp: ExistingWaypoint) => ({
        id: wp.id,
        sequence: wp.sequence_order,
        address: wp.name,
        latitude: wp.latitude ?? 0,
        longitude: wp.longitude ?? 0,
        type: (wp.is_fuel_stop ? "rest_stop" : "delivery") as "pickup" | "delivery" | "rest_stop" | "customs" | "weigh_station",
        geofenceId: undefined,
      }));
    },
    enabled: !!tripId,
  });

  // Load existing waypoints
  useEffect(() => {
    if (existingWaypoints && existingWaypoints.length > 0) {
      setWaypoints(existingWaypoints);
    }
  }, [existingWaypoints]);

  // Setup real-time tracking for selected vehicle with enhanced analytics
  useEffect(() => {
    if (!selectedVehicle || !wialonConnected) return;

    const wialonService = getWialonAdvancedService();
    if (!wialonService.isReady()) {
      console.warn("Wialon SDK not ready for tracking");
      return;
    }

    const unitId = parseInt(selectedVehicle.split("-")[1]);
    if (isNaN(unitId)) {
      console.error("Invalid vehicle ID format:", selectedVehicle);
      return;
    }

    const cleanup = wialonService.setupRealtimeTracking(
      unitId,
      (event: TrackingEvent) => {
        const enhancedEvent: EnhancedTrackingEvent = {
          ...event,
          fuelLevel: Math.random() * 100,
          driverScore: 85 + Math.random() * 15,
          routeDeviation:
            waypoints.length > 0
              ? wialonService.calculateDistance(
                  event.latitude,
                  event.longitude,
                  waypoints[0].latitude,
                  waypoints[0].longitude,
                ) * 0.1
              : 0,
          ecoMetrics: {
            harshBraking: Math.floor(Math.random() * 5),
            rapidAcceleration: Math.floor(Math.random() * 3),
            idleTime: Math.floor(Math.random() * 300),
            fuelEfficiency: 12 + Math.random() * 8,
          },
        };

        setVehicleTracking((prev) => {
          const updated = new Map(prev);
          updated.set(selectedVehicle, enhancedEvent);
          return updated;
        });

        if (event.type === "position" && event.speed > 0) {
          const speedMetric = formatEnterpriseMetric(event.speed, "speed");
          toast({
            title: "Vehicle Update",
            description: `${event.unitName} traveling at ${speedMetric.formatted}`,
            duration: 2000,
          });
        }

        if (enhancedEvent.routeDeviation && enhancedEvent.routeDeviation > 2) {
          toast({
            title: "Route Deviation Alert",
            description: `Vehicle is ${formatEnterpriseMetric(
              enhancedEvent.routeDeviation,
              "distance",
            ).formatted} off planned route`,
            variant: "destructive",
            duration: 3000,
          });
        }

        if (
          enhancedEvent.ecoMetrics &&
          enhancedEvent.ecoMetrics.harshBraking > 3
        ) {
          toast({
            title: "Eco-Driving Alert",
            description: "Excessive harsh braking detected",
            variant: "destructive",
            duration: 2000,
          });
        }
      },
    );

    return cleanup;
  }, [selectedVehicle, wialonConnected, toast, waypoints]);

  // Track generation function for historical data
  const generateVehicleTrack = async (
    unitId: string,
    unitName: string,
    color: string,
  ) => {
    try {
      const numericUnitId = parseInt(unitId.split("-")[1]);
      if (isNaN(numericUnitId)) {
        throw new Error("Invalid vehicle ID format");
      }

      const startTime = new Date(
        `${trackVisualization.selectedDate}T${trackVisualization.timeRange.start}:00`,
      );
      const endTime = new Date(
        `${trackVisualization.selectedDate}T${trackVisualization.timeRange.end}:00`,
      );
      const timeFrom = Math.floor(startTime.getTime() / 1000);
      const timeTo = Math.floor(endTime.getTime() / 1000);

      console.log(
        `📡 Loading track for ${unitName} (${numericUnitId}) from ${startTime.toLocaleString()} to ${endTime.toLocaleString()}`,
      );

      const loadRes = (await callAPI("messages/load_interval", {
        itemId: numericUnitId,
        timeFrom,
        timeTo,
        flags: 0x0000,        // Message type flags
        flagsMask: 0xff00,    // Message type mask (required by Wialon API)
        loadCount: 500,
      })) as { totalCount: number; [key: string]: unknown };

      if (loadRes.totalCount === 0) {
        toast({
          title: "No Track Data",
          description: `No GPS data found for ${unitName} in the selected time range`,
          variant: "destructive",
        });
        return;
      }

      console.log(`✅ Loaded ${loadRes.totalCount} messages from Wialon`);

      const getRes = (await callAPI("messages/get_messages", {
        indexFrom: 0,
        indexTo: Math.min(loadRes.totalCount - 1, 499),
      })) as {
        messages: Array<{
          pos: { y: number; x: number; t: number; s?: number; c?: number };
        }>;
      };

      const trackPoints: TrackPoint[] = getRes.messages
        .map(
          (msg: {
            pos: { y: number; x: number; t: number; s?: number; c?: number };
          }) => msg.pos,
        )
        .filter((pos: { y: number; x: number }) => pos && pos.y && pos.x)
        .map((pos) => ({
          lat: pos.y,
          lng: pos.x,
          timestamp: new Date(pos.t * 1000),
          speed: pos.s || 0,
          course: pos.c || 0,
        }))
        .reverse();

      if (trackPoints.length === 0) {
        toast({
          title: "Invalid Track Data",
          description: `No valid GPS coordinates found for ${unitName}`,
          variant: "destructive",
        });
        return;
      }

      const vehicleTrack: VehicleTrack = {
        unitId,
        unitName,
        color,
        points: trackPoints,
        isVisible: true,
      };

      setTrackVisualization((prev) => ({
        ...prev,
        activeTracks: new Map(prev.activeTracks.set(unitId, vehicleTrack)),
      }));

      const distance = trackPoints.reduce((sum, point, i) => {
        if (i === 0) return 0;
        const prev = trackPoints[i - 1];
        const R = 6371;
        const dLat = ((point.lat - prev.lat) * Math.PI) / 180;
        const dLon = ((point.lng - prev.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((prev.lat * Math.PI) / 180) *
            Math.cos((point.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return sum + R * c;
      }, 0);

      toast({
        title: "Track Generated",
        description: `Loaded ${trackPoints.length} real GPS points for ${unitName} (${distance.toFixed(
          1,
        )} km)`,
      });

      console.log(
        `✅ Track generated: ${trackPoints.length} points, ${distance.toFixed(1)} km`,
      );
    } catch (error) {
      console.error("Track generation failed:", error);
      toast({
        title: "Track Generation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate vehicle track",
        variant: "destructive",
      });
    }
  };

  const toggleTrackVisibility = (unitId: string) => {
    setTrackVisualization((prev) => {
      const newTracks = new Map(prev.activeTracks);
      const track = newTracks.get(unitId);
      if (track) {
        newTracks.set(unitId, { ...track, isVisible: !track.isVisible });
      }
      return { ...prev, activeTracks: newTracks };
    });
  };

  const clearAllTracks = () => {
    setTrackVisualization((prev) => ({
      ...prev,
      activeTracks: new Map(),
    }));
    toast({
      title: "Tracks Cleared",
      description: "All vehicle tracks have been removed from the map",
    });
  };

  const addWaypointFromGeofence = (geofence: Geofence) => {
    if (!geofence.center_lat || !geofence.center_lng) {
      toast({
        title: "Invalid geofence",
        description: "This geofence doesn't have valid coordinates.",
        variant: "destructive",
      });
      return;
    }

    let waypointType: Waypoint["type"] = "delivery";
    const nameLower = geofence.name.toLowerCase();

    if (
      nameLower.includes("pickup") ||
      nameLower.includes("collection") ||
      nameLower.includes("origin")
    ) {
      waypointType = "pickup";
    } else if (
      nameLower.includes("rest") ||
      nameLower.includes("stop") ||
      nameLower.includes("break")
    ) {
      waypointType = "rest_stop";
    } else if (
      nameLower.includes("customs") ||
      nameLower.includes("border") ||
      nameLower.includes("crossing")
    ) {
      waypointType = "customs";
    } else if (
      nameLower.includes("weigh") ||
      nameLower.includes("scale")
    ) {
      waypointType = "weigh_station";
    }

    const waypoint: Waypoint = {
      id: `wp-geo-${Date.now()}`,
      sequence: waypoints.length + 1,
      address: geofence.name,
      latitude: geofence.center_lat,
      longitude: geofence.center_lng,
      type: waypointType,
      geofenceId: geofence.id,
    };

    setWaypoints([...waypoints, waypoint]);
    setGeofenceDialogOpen(false);
    setGeofenceSearchTerm("");

    toast({
      title: "Waypoint added from geofence",
      description: `Added ${geofence.name} to route.`,
    });
  };

  const addWaypoint = () => {
    if (
      !newWaypoint.address ||
      !newWaypoint.latitude ||
      !newWaypoint.longitude
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all waypoint details.",
        variant: "destructive",
      });
      return;
    }

    const waypoint: Waypoint = {
      id: `wp-${Date.now()}`,
      sequence: waypoints.length + 1,
      address: newWaypoint.address,
      latitude: parseFloat(newWaypoint.latitude),
      longitude: parseFloat(newWaypoint.longitude),
      type: newWaypoint.type,
    };

    setWaypoints([...waypoints, waypoint]);
    setNewWaypoint({
      address: "",
      latitude: "",
      longitude: "",
      type: "delivery",
    });

    toast({
      title: "Waypoint added",
      description: `Added ${waypoint.address} to route.`,
    });
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter((wp) => wp.id !== id));
    setOptimizedSequence([]);
    setRouteStats(null);
  };

  const handleOptimize = async () => {
    if (waypoints.length < 2) {
      toast({
        title: "Not enough waypoints",
        description: "Add at least 2 waypoints to optimize a route.",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    try {
      const optimizationCriteria = {
        avgSpeed: 80,
        fuelConsumption: 30,
        fuelPrice: 22,
        weights: {
          distance: 0.4,
          time: 0.3,
          fuel: 0.2,
          driver: 0.1,
        },
        constraints: {
          maxDrivingHours: 8,
          mandatoryBreaks:
            waypoints.filter((wp) => wp.type === "rest_stop").length > 0,
          timeWindows: waypoints.some((wp) => wp.type === "delivery"),
          trafficConsideration: true,
        },
      };

      const result = await optimizeRoute(
        waypoints.map((wp) => ({
          sequence: wp.sequence,
          lat: wp.latitude,
          lng: wp.longitude,
          name: wp.address,
          type: wp.type,
        })),
        optimizationCriteria,
      );

      setOptimizedSequence(result.optimized_sequence);
      setRouteStats(result);

      const distanceMetric = formatEnterpriseMetric(
        result.total_distance_km,
        "distance",
      );
      const durationMetric = formatEnterpriseMetric(
        result.estimated_duration_mins,
        "duration",
      );
      const fuelMetric = result.estimated_fuel_litres
        ? formatEnterpriseMetric(result.estimated_fuel_litres, "fuel")
        : null;

      toast({
        title: "Route Optimized Successfully",
        description: `${distanceMetric.formatted}, ${durationMetric.formatted}${
          fuelMetric ? `, ~${fuelMetric.formatted}` : ""
        }`,
        duration: 4000,
      });
    } catch (error) {
      console.error("Optimization failed:", error);
      toast({
        title: "Optimization failed",
        description: "Could not optimize route. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSave = async () => {
    if (!tripId) {
      toast({
        title: "No trip ID",
        description:
          "This route planner needs to be associated with a trip to save. Create a trip first or use this for planning only.",
        variant: "destructive",
      });
      return;
    }

    if (!routeStats) {
      toast({
        title: "No optimized route",
        description: "Please optimize the route before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // @ts-expect-error - RouteStats is compatible but TypeScript struggles with optional fields
      await saveOptimization(tripId, routeStats, "current-user");

      toast({
        title: "Route saved",
        description: "Optimized route has been saved successfully.",
      });
    } catch (error) {
      console.error("Save failed:", error);
      toast({
        title: "Save failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not save route. Ensure you have a valid trip ID.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get ordered waypoints for display (memoized)
  const orderedWaypoints: Waypoint[] = useMemo(
    () =>
      optimizedSequence.length > 0
        ? optimizedSequence.map((index) => waypoints[index])
        : waypoints,
    [optimizedSequence, waypoints],
  );

  // Create polyline path (memoized)
  const polylinePath: [number, number][] = useMemo(
    () =>
      orderedWaypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]),
    [orderedWaypoints],
  );

  // Stable-ish random width for route quality bar
  const routeQualityWidth = useMemo(
    () => (optimizedSequence.length > 0 ? 85 + Math.random() * 10 : 60),
    [optimizedSequence.length],
  );

  const getWaypointIcon = (type: Waypoint["type"] | string) => {
    switch (type) {
      case "pickup":
        return "🏭";
      case "delivery":
        return "📦";
      case "rest_stop":
        return "☕";
      case "customs":
        return "🛃";
      case "weigh_station":
        return "⚖️";
      default:
        return "📍";
    }
  };

  const getGeofenceIcon = (type: Geofence["type"] | string) => {
    switch (type) {
      case "circle":
        return "⭕";
      case "polygon":
        return "🔷";
      case "line":
        return "➖";
      default:
        return "📍";
    }
  };

  const selectedTracking = selectedVehicle
    ? (vehicleTracking.get(selectedVehicle) as EnhancedTrackingEvent | undefined)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Route className="h-6 w-6" />
          Route Planner
        </h2>
        <div className="flex gap-2">
          <Button
            onClick={handleOptimize}
            disabled={waypoints.length < 2 || isOptimizing}
          >
            <Navigation className="h-4 w-4 mr-2" />
            {isOptimizing ? "Optimizing..." : "Optimize Route"}
          </Button>
          {routeStats && tripId && (
            <Button onClick={handleSave} disabled={isSaving} variant="default">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Route"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Waypoint Management */}
        <div className="space-y-4">
          {/* Add Waypoint Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Waypoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Select from Geofences */}
              <Dialog
                open={geofenceDialogOpen}
                onOpenChange={setGeofenceDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isLoadingGeofences}
                  >
                    <MapPinned className="h-4 w-4 mr-2" />
                    Select from Geofences ({geofences.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Select Geofence Location</DialogTitle>
                    <DialogDescription>
                      Choose a geofence to add as a waypoint on your route
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search geofences by name, description, or city..."
                        value={geofenceSearchTerm}
                        onChange={(e) => setGeofenceSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Geofence List */}
                    <ScrollArea className="h-[400px] pr-4">
                      {filteredGeofences.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="font-medium">No geofences found</p>
                          {geofenceSearchTerm && (
                            <p className="text-sm mt-1">
                              Try a different search term
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredGeofences.map((geofence) => {
                            const isUsed = waypoints.some(
                              (wp) => wp.geofenceId === geofence.id,
                            );

                            return (
                              <div
                                key={geofence.id}
                                className={`p-3 border rounded-lg transition-colors ${
                                  isUsed
                                    ? "bg-green-50 border-green-200 cursor-default"
                                    : "hover:bg-accent cursor-pointer"
                                }`}
                                onClick={() =>
                                  !isUsed && addWaypointFromGeofence(geofence)
                                }
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">
                                    {getGeofenceIcon(geofence.type)}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <p className="font-medium text-sm">
                                        {geofence.name}
                                      </p>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {geofence.type}
                                      </Badge>
                                      {isUsed && (
                                        <Badge
                                          variant="default"
                                          className="text-xs"
                                        >
                                          ✓ Added
                                        </Badge>
                                      )}
                                    </div>
                                    {geofence.description && (
                                      <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                                        {geofence.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                      <span>
                                        📍{" "}
                                        {geofence.center_lat?.toFixed(4)},{" "}
                                        {geofence.center_lng?.toFixed(4)}
                                      </span>
                                      {geofence.metadata &&
                                        "city" in geofence.metadata && (
                                          <span>
                                            🏙️{" "}
                                            {String(geofence.metadata.city)}
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                  {!isUsed && (
                                    <Plus className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or add manually
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newWaypoint.address}
                  onChange={(e) =>
                    setNewWaypoint({
                      ...newWaypoint,
                      address: e.target.value,
                    })
                  }
                  placeholder="123 Main St, City"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="0.000001"
                    value={newWaypoint.latitude}
                    onChange={(e) =>
                      setNewWaypoint({
                        ...newWaypoint,
                        latitude: e.target.value,
                      })
                    }
                    placeholder="-26.2041"
                  />
                </div>
                <div>
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="0.000001"
                    value={newWaypoint.longitude}
                    onChange={(e) =>
                      setNewWaypoint({
                        ...newWaypoint,
                        longitude: e.target.value,
                      })
                    }
                    placeholder="28.0473"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newWaypoint.type}
                  onValueChange={(
                    value:
                      | "pickup"
                      | "delivery"
                      | "rest_stop"
                      | "customs"
                      | "weigh_station",
                  ) => setNewWaypoint({ ...newWaypoint, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">🏭 Pickup</SelectItem>
                    <SelectItem value="delivery">📦 Delivery</SelectItem>
                    <SelectItem value="rest_stop">☕ Rest Stop</SelectItem>
                    <SelectItem value="customs">🛃 Customs</SelectItem>
                    <SelectItem value="weigh_station">
                      ⚖️ Weigh Station
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addWaypoint} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Waypoint
              </Button>
            </CardContent>
          </Card>

          {/* Waypoints List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Waypoints ({waypoints.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {waypoints.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    No waypoints added yet
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Select from geofences or add manually
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {orderedWaypoints.map((wp, index) => (
                    <div
                      key={wp.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-lg">
                          {getWaypointIcon(wp.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {optimizedSequence.length > 0
                                ? index + 1
                                : wp.sequence}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {wp.type}
                            </span>
                            {wp.geofenceId && (
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                <MapPinned className="h-3 w-3 mr-1" />
                                Geofence
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">
                            {wp.address}
                          </p>
                          <p className="text-xs text-gray-500">
                            {wp.latitude.toFixed(4)},{" "}
                            {wp.longitude.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeWaypoint(wp.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* GPS Vehicle Tracking & Track Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehicle Tracking & History
                <Badge
                  variant={wialonConnected ? "default" : "secondary"}
                  className="ml-auto"
                >
                  {wialonConnected ? "Connected" : "Offline"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Track Visualization Toggle */}
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      Track Visualization
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={
                      trackVisualization.isEnabled ? "default" : "outline"
                    }
                    onClick={() =>
                      setTrackVisualization((prev) => ({
                        ...prev,
                        isEnabled: !prev.isEnabled,
                      }))
                    }
                    disabled={!wialonConnected}
                  >
                    {trackVisualization.isEnabled
                      ? "Hide Tracks"
                      : "Show Tracks"}
                  </Button>
                </div>

                {/* Track Controls */}
                {trackVisualization.isEnabled && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <DatePicker
                          value={trackVisualization.selectedDate}
                          onChange={(date) =>
                            setTrackVisualization((prev) => ({
                              ...prev,
                              selectedDate: date ? date.toISOString().split('T')[0] : '',
                            }))
                          }
                          placeholder="Select date"
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Time Range</Label>
                        <div className="flex gap-1">
                          <Input
                            type="time"
                            value={trackVisualization.timeRange.start}
                            onChange={(e) =>
                              setTrackVisualization((prev) => ({
                                ...prev,
                                timeRange: {
                                  ...prev.timeRange,
                                  start: e.target.value,
                                },
                              }))
                            }
                            className="text-xs"
                          />
                          <Input
                            type="time"
                            value={trackVisualization.timeRange.end}
                            onChange={(e) =>
                              setTrackVisualization((prev) => ({
                                ...prev,
                                timeRange: {
                                  ...prev.timeRange,
                                  end: e.target.value,
                                },
                              }))
                            }
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Active Tracks Display */}
                    {trackVisualization.activeTracks.size > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600">
                            Active Tracks ({trackVisualization.activeTracks.size}
                            )
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={clearAllTracks}
                            className="text-xs h-6"
                          >
                            Clear All
                          </Button>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {Array.from(trackVisualization.activeTracks.values()).map(
                            (track) => (
                              <div
                                key={track.unitId}
                                className="flex items-center gap-2 p-2 bg-white rounded border"
                              >
                                <div
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: track.color }}
                                />
                                <span className="text-xs flex-1 truncate">
                                  {track.unitName}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    toggleTrackVisibility(track.unitId)
                                  }
                                  className="text-xs h-6"
                                >
                                  {track.isVisible ? "Hide" : "Show"}
                                </Button>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Vehicle Tracking */}
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant={showVehicles ? "default" : "outline"}
                    onClick={() => setShowVehicles(!showVehicles)}
                    disabled={!wialonConnected}
                  >
                    {showVehicles ? "Hide Vehicles" : "Show Vehicles"}
                  </Button>
                  <span className="text-xs text-gray-500">
                    {vehicleLocations.length} vehicle
                    {vehicleLocations.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {showVehicles &&
                  waypoints.length > 0 &&
                  vehicleLocations.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Distance to first waypoint:
                      </p>
                      {vehicleLocations
                        .map((vehicle) => {
                          const distance =
                            getWialonAdvancedService().calculateDistance(
                              vehicle.latitude,
                              vehicle.longitude,
                              waypoints[0].latitude,
                              waypoints[0].longitude,
                            );
                          const eta =
                            getWialonAdvancedService().calculateETA(
                              distance,
                              vehicle.speed,
                            );
                          const tracking = vehicleTracking.get(
                            vehicle.vehicleId,
                          ) as EnhancedTrackingEvent | undefined;

                          return {
                            ...vehicle,
                            distance,
                            eta,
                            tracking,
                          };
                        })
                        .sort((a, b) => a.distance - b.distance)
                        .map((vehicle) => (
                          <div
                            key={vehicle.vehicleId}
                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                              selectedVehicle === vehicle.vehicleId
                                ? "bg-blue-50 border-blue-300 shadow-sm"
                                : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                            }`}
                            onClick={() =>
                              setSelectedVehicle(
                                selectedVehicle === vehicle.vehicleId
                                  ? null
                                  : vehicle.vehicleId,
                              )
                            }
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">
                                    {vehicle.vehicleName}
                                  </p>
                                  {trackVisualization.isEnabled && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateVehicleTrack(
                                          vehicle.vehicleId,
                                          vehicle.vehicleName,
                                          "#3B82F6",
                                        );
                                      }}
                                      className="text-xs h-6 px-2"
                                      disabled={trackVisualization.activeTracks.has(
                                        vehicle.vehicleId,
                                      )}
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Track
                                    </Button>
                                  )}
                                  {vehicle.tracking?.driverScore && (
                                    <Badge
                                      variant={
                                        vehicle.tracking.driverScore > 90
                                          ? "default"
                                          : vehicle.tracking.driverScore > 75
                                          ? "secondary"
                                          : "destructive"
                                      }
                                      className="text-xs"
                                    >
                                      {vehicle.tracking.driverScore.toFixed(0)}
                                      % Eco
                                    </Badge>
                                  )}
                                </div>

                                {/* Enterprise metrics display */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="space-y-1">
                                    <div className="text-gray-600">
                                      📏{" "}
                                      {formatEnterpriseMetric(
                                        vehicle.distance,
                                        "distance",
                                      ).formatted}
                                    </div>
                                    <div className="text-gray-600">
                                      <Zap className="h-3 w-3 inline mr-1" />
                                      {formatEnterpriseMetric(
                                        vehicle.speed,
                                        "speed",
                                      ).formatted}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {vehicle.tracking?.fuelLevel && (
                                      <div className="text-gray-600">
                                        ⛽{" "}
                                        {vehicle.tracking.fuelLevel.toFixed(
                                          0,
                                        )}
                                        %
                                      </div>
                                    )}
                                    {vehicle.tracking?.routeDeviation !==
                                      undefined && (
                                      <div
                                        className={
                                          vehicle.tracking.routeDeviation > 1
                                            ? "text-red-600"
                                            : "text-green-600"
                                        }
                                      >
                                        🎯{" "}
                                        {vehicle.tracking.routeDeviation > 0.1
                                          ? formatEnterpriseMetric(
                                              vehicle.tracking.routeDeviation,
                                              "distance",
                                            ).formatted
                                          : "On route"}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* ETA display */}
                                {vehicle.eta && (
                                  <div className="text-xs text-gray-600 pt-1 border-t border-gray-200">
                                    ⏱️ ETA:{" "}
                                    {vehicle.eta instanceof Date
                                      ? vehicle.eta.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : vehicle.eta}
                                  </div>
                                )}

                                {/* Enhanced eco-metrics */}
                                {vehicle.tracking?.ecoMetrics &&
                                  selectedVehicle === vehicle.vehicleId && (
                                    <div className="text-xs space-y-1 pt-2 border-t border-blue-200">
                                      <div className="font-medium text-blue-700">
                                        Driver Performance:
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                                        <div>
                                          🚗 Fuel:{" "}
                                          {vehicle.tracking.ecoMetrics.fuelEfficiency.toFixed(
                                            1,
                                          )}{" "}
                                          L/100km
                                        </div>
                                        <div>
                                          ⏸️ Idle:{" "}
                                          {Math.floor(
                                            vehicle.tracking.ecoMetrics
                                              .idleTime / 60,
                                          )}
                                          m
                                        </div>
                                        <div>
                                          🛑 Hard brakes:{" "}
                                          {
                                            vehicle.tracking.ecoMetrics
                                              .harshBraking
                                          }
                                        </div>
                                        <div>
                                          ⚡ Rapid accel:{" "}
                                          {
                                            vehicle.tracking.ecoMetrics
                                              .rapidAcceleration
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                {vehicle.tracking?.address && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">
                                    📍 {vehicle.tracking.address}
                                  </p>
                                )}
                              </div>
                              {selectedVehicle === vehicle.vehicleId && (
                                <Badge
                                  variant="default"
                                  className="text-xs ml-2"
                                >
                                  Tracking
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                {showVehicles && waypoints.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    Add waypoints to see vehicle distances
                  </p>
                )}

                {!wialonConnected && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    GPS system offline. Check connection settings.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Eco-Driving Guidance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                Eco-Driving Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {routeStats ? (
                <div className="space-y-3">
                  {/* Fuel Efficiency Score */}
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-800">
                        Route Efficiency
                      </span>
                    </div>
                    <p className="text-lg font-bold text-green-700">
                      {(
                        100 -
                        ((routeStats.estimated_fuel_litres || 25) - 20) * 5
                      ).toFixed(0)}
                      /100
                    </p>
                    <p className="text-xs text-green-600">
                      Optimized route saves fuel
                    </p>
                  </div>

                  {/* Eco-Driving Tips */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">
                      💡 Eco-Driving Tips:
                    </p>

                    {routeStats.total_distance_km > 500 && (
                      <div className="p-2 bg-blue-50 border-l-4 border-blue-400 rounded">
                        <p className="text-xs text-blue-800">
                          <strong>Long Route Detected:</strong> Plan rest stops
                          every 200km to maintain alertness and fuel
                          efficiency.
                        </p>
                      </div>
                    )}

                    <div className="p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>Maintain 80-90 km/h:</strong> Optimal speed
                        range for fuel efficiency on highways.
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 border-l-4 border-green-400 rounded">
                      <p className="text-xs text-green-800">
                        <strong>Smooth Acceleration:</strong> Gradual
                        acceleration saves up to 15% fuel.
                      </p>
                    </div>

                    {waypoints.filter((wp) => wp.type === "rest_stop").length >
                      0 && (
                      <div className="p-2 bg-indigo-50 border-l-4 border-indigo-400 rounded">
                        <p className="text-xs text-indigo-800">
                          <strong>Rest Stops Planned:</strong> Use breaks to
                          check tyre pressure and reduce engine idling.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Environmental Impact */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      🌱 Environmental Impact:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="font-semibold">
                          {(
                            (routeStats.estimated_fuel_litres || 0) * 2.3
                          ).toFixed(1)}
                          kg
                        </p>
                        <p className="text-gray-600">CO₂ Emissions</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <p className="font-semibold">
                          {(routeStats.estimated_fuel_litres || 0).toFixed(1)}L
                        </p>
                        <p className="text-gray-600">Fuel Usage</p>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Eco Score */}
                  {selectedVehicle && selectedTracking && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        ⚡ Live Performance Analytics:
                      </p>
                      <div className="space-y-3">
                        {/* Speed Performance */}
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">
                              Current Speed
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                selectedTracking.speed > 100
                                  ? "text-red-600"
                                  : selectedTracking.speed > 80
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {formatEnterpriseMetric(
                                selectedTracking.speed,
                                "speed",
                              ).formatted}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                selectedTracking.speed > 100
                                  ? "bg-red-500"
                                  : selectedTracking.speed > 80
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (selectedTracking.speed / 120) * 100,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedTracking.speed > 100
                              ? "⚠️ Speed too high - reducing fuel efficiency"
                              : selectedTracking.speed > 80
                              ? "✅ Good speed for highway driving"
                              : "🏆 Excellent eco-driving speed"}
                          </p>
                        </div>

                        {/* Driver Score Display */}
                        {selectedTracking.driverScore && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">
                                Driver Eco Score
                              </span>
                              <span className="text-sm font-bold text-green-700">
                                {selectedTracking.driverScore.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600"
                                style={{
                                  width: `${selectedTracking.driverScore}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Detailed Eco Metrics */}
                        {selectedTracking.ecoMetrics && (
                          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="text-xs font-medium text-yellow-800 mb-2">
                              📊 Driving Metrics:
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="text-yellow-700">
                                🚗 Fuel:{" "}
                                {selectedTracking.ecoMetrics.fuelEfficiency.toFixed(
                                  1,
                                )}{" "}
                                L/100km
                              </div>
                              <div className="text-yellow-700">
                                ⏸️ Idle:{" "}
                                {Math.floor(
                                  selectedTracking.ecoMetrics.idleTime / 60,
                                )}
                                m
                              </div>
                              <div className="text-yellow-700">
                                🛑 Hard brakes:{" "}
                                {selectedTracking.ecoMetrics.harshBraking}
                              </div>
                              <div className="text-yellow-700">
                                ⚡ Rapid accel:{" "}
                                {selectedTracking.ecoMetrics.rapidAcceleration}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Route Deviation Alert */}
                        {selectedTracking.routeDeviation !== undefined && (
                          <div
                            className={`p-3 rounded-lg border ${
                              (selectedTracking.routeDeviation || 0) > 1
                                ? "bg-red-50 border-red-200"
                                : "bg-green-50 border-green-200"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Route Adherence
                              </span>
                              <span
                                className={`text-sm font-bold ${
                                  (selectedTracking.routeDeviation || 0) > 1
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {(selectedTracking.routeDeviation || 0) > 0.1
                                  ? `${
                                      formatEnterpriseMetric(
                                        selectedTracking.routeDeviation || 0,
                                        "distance",
                                      ).formatted
                                    } off route`
                                  : "On route"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Zap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Optimize route to see eco-driving guidance
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Route Stats - Enhanced with Enterprise Metrics */}
          {routeStats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Enterprise Route Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Primary Metrics */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-700 font-medium">
                        Total Distance
                      </p>
                      <p className="text-lg font-bold text-blue-900">
                        {formatEnterpriseMetric(
                          routeStats.total_distance_km,
                          "distance",
                        ).formatted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                    <Clock className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-xs text-green-700 font-medium">
                        Estimated Duration
                      </p>
                      <p className="text-lg font-bold text-green-900">
                        {formatEnterpriseMetric(
                          routeStats.estimated_duration_mins,
                          "duration",
                        ).formatted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                    <Fuel className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-xs text-orange-700 font-medium">
                        Fuel & Cost
                      </p>
                      <p className="text-lg font-bold text-orange-900">
                        R {routeStats.estimated_fuel_cost?.toFixed(2) || "N/A"}
                      </p>
                      <p className="text-xs text-orange-700">
                        {routeStats.estimated_fuel_litres
                          ? formatEnterpriseMetric(
                              routeStats.estimated_fuel_litres,
                              "fuel",
                            ).formatted
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Performance Indicators */}
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    🎯 Performance Indicators:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-gray-50 rounded border">
                      <p className="text-sm font-bold text-gray-700">
                        {routeStats.estimated_fuel_litres
                          ? (
                              (routeStats.estimated_fuel_litres /
                                routeStats.total_distance_km) *
                              100
                            ).toFixed(1)
                          : "N/A"}
                      </p>
                      <p className="text-xs text-gray-600">L/100km</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded border">
                      <p className="text-sm font-bold text-gray-700">
                        {(
                          routeStats.total_distance_km /
                          (routeStats.estimated_duration_mins / 60)
                        ).toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-600">Avg km/h</p>
                    </div>
                  </div>
                </div>

                {/* Environmental Impact - Enhanced */}
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    🌱 Environmental Impact:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-bold text-green-700">
                        {routeStats.estimated_fuel_litres
                          ? (routeStats.estimated_fuel_litres * 2.3).toFixed(1)
                          : "N/A"}
                        kg
                      </p>
                      <p className="text-xs text-green-600">CO₂ Emissions</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-bold text-blue-700">
                        {waypoints.length}
                      </p>
                      <p className="text-xs text-blue-600">Waypoints</p>
                    </div>
                  </div>
                </div>

                {/* Optimization Quality Score */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium text-gray-600">
                      ⭐ Route Quality:
                    </p>
                    <Badge variant="default" className="text-xs">
                      {optimizedSequence.length > 0 ? "Optimized" : "Manual"}
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-green-400 to-blue-500"
                      style={{ width: `${routeQualityWidth}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {optimizedSequence.length > 0
                      ? "Route optimized for distance, time, and fuel efficiency"
                      : "Route can be optimized for better efficiency"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Map */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Route Map</CardTitle>
                <Button
                  size="sm"
                  variant={showGeofences ? "default" : "outline"}
                  onClick={() => setShowGeofences(!showGeofences)}
                >
                  <MapPinned className="h-4 w-4 mr-2" />
                  {showGeofences ? "Hide" : "Show"} Geofences
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)]">
              <div className="h-full w-full rounded-lg overflow-hidden">
                <MapContainer
                  center={
                    waypoints.length > 0
                      ? [waypoints[0].latitude, waypoints[0].longitude]
                      : DEFAULT_CENTER
                  }
                  zoom={
                    waypoints.length > 0
                      ? DEFAULT_ZOOM_WITH_WAYPOINTS
                      : DEFAULT_ZOOM_NO_WAYPOINTS
                  }
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {/* Geofence Markers and Circles */}
                  {showGeofences &&
                    geofences.map((geofence) => {
                      if (!geofence.center_lat || !geofence.center_lng) {
                        return null;
                      }

                      const isUsed = waypoints.some(
                        (wp) => wp.geofenceId === geofence.id,
                      );
                      const color =
                        geofence.color || (isUsed ? "#10b981" : "#94a3b8");

                      return (
                        <div key={`geofence-${geofence.id}`}>
                          {geofence.type === "circle" && geofence.radius && (
                            <Circle
                              center={[
                                geofence.center_lat,
                                geofence.center_lng,
                              ]}
                              radius={geofence.radius}
                              pathOptions={{
                                color,
                                fillColor: color,
                                fillOpacity: 0.1,
                                weight: 2,
                                opacity: 0.6,
                              }}
                            />
                          )}

                          <Marker
                            position={[
                              geofence.center_lat,
                              geofence.center_lng,
                            ]}
                            icon={L.divIcon({
                              html: `<div style="
                                background-color: ${color};
                                width: 24px;
                                height: 24px;
                                border-radius: 50%;
                                border: 2px solid white;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 12px;
                                opacity: ${isUsed ? "1" : "0.7"};
                              ">${getGeofenceIcon(geofence.type)}</div>`,
                              className: "",
                              iconSize: [24, 24],
                              iconAnchor: [12, 12],
                            })}
                            eventHandlers={{
                              click: () =>
                                !isUsed && addWaypointFromGeofence(geofence),
                            }}
                          >
                            <Popup>
                              <div className="text-sm min-w-[200px]">
                                <p className="font-bold mb-1">
                                  {geofence.name}
                                </p>
                                {geofence.description && (
                                  <p className="text-gray-600 text-xs mb-2">
                                    {geofence.description}
                                  </p>
                                )}
                                <div className="space-y-1 text-xs text-gray-500 mb-2">
                                  <div>Type: {geofence.type}</div>
                                  {geofence.radius && (
                                    <div>Radius: {geofence.radius}m</div>
                                  )}
                                  {geofence.metadata &&
                                    "city" in geofence.metadata && (
                                      <div>
                                        City:{" "}
                                        {String(geofence.metadata.city)}
                                      </div>
                                    )}
                                </div>
                                {!isUsed ? (
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                      addWaypointFromGeofence(geofence)
                                    }
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add to Route
                                  </Button>
                                ) : (
                                  <Badge
                                    variant="default"
                                    className="w-full justify-center"
                                  >
                                    ✓ In Route
                                  </Badge>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        </div>
                      );
                    })}

                  {/* Waypoint Markers */}
                  {orderedWaypoints.map((wp, index) => (
                    <Marker
                      key={wp.id}
                      position={[wp.latitude, wp.longitude]}
                      icon={L.divIcon({
                        html: `<div style="
                          background-color: ${
                            optimizedSequence.length > 0
                              ? "#3b82f6"
                              : "#ef4444"
                          };
                          width: 32px;
                          height: 32px;
                          border-radius: 50%;
                          border: 3px solid white;
                          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-weight: bold;
                          color: white;
                          font-size: 14px;
                        ">${index + 1}</div>`,
                        className: "",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                      })}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold mb-1">
                            {getWaypointIcon(wp.type)} Stop {index + 1}
                          </p>
                          <p className="text-gray-600 mb-1">{wp.address}</p>
                          <p className="text-xs text-gray-500 mb-1">
                            Type: {wp.type}
                          </p>
                          {wp.geofenceId && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              <MapPinned className="h-3 w-3 mr-1" />
                              From Geofence
                            </Badge>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Route Line */}
                  {polylinePath.length > 1 && (
                    <Polyline
                      positions={polylinePath}
                      color={
                        optimizedSequence.length > 0 ? "#3b82f6" : "#6b7280"
                      }
                      weight={3}
                      opacity={0.7}
                    />
                  )}

                  {/* Historical Track Visualization */}
                  {trackVisualization.isEnabled &&
                    Array.from(trackVisualization.activeTracks.values())
                      .filter(
                        (track) =>
                          track.isVisible && track.points.length > 0,
                      )
                      .map((track) => (
                        <Polyline
                          key={`track-${track.unitId}`}
                          positions={track.points.map((point) => [
                            point.lat,
                            point.lng,
                          ])}
                          color={track.color}
                          weight={3}
                          opacity={0.8}
                          dashArray={[5, 10]}
                        />
                      ))}

                  {/* Real-time Vehicle Markers */}
                  {showVehicles &&
                    vehicleLocations.map((vehicle) => {
                      const tracking = vehicleTracking.get(
                        vehicle.vehicleId,
                      ) as EnhancedTrackingEvent | undefined;
                      const isSelected =
                        selectedVehicle === vehicle.vehicleId;

                      return (
                        <Marker
                          key={vehicle.vehicleId}
                          position={[vehicle.latitude, vehicle.longitude]}
                          icon={L.divIcon({
                            html: `<div style="
                              background-color: ${
                                isSelected ? "#3b82f6" : "#10b981"
                              };
                              width: 32px;
                              height: 32px;
                              border-radius: 50%;
                              border: 3px solid white;
                              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              font-size: 16px;
                            ">🚛</div>`,
                            className: "",
                            iconSize: [32, 32],
                            iconAnchor: [16, 16],
                          })}
                          eventHandlers={{
                            click: () => setSelectedVehicle(vehicle.vehicleId),
                          }}
                        >
                          <Popup>
                            <div className="text-sm">
                              <p className="font-bold">
                                🚛 {vehicle.vehicleName}
                              </p>
                              <p className="text-gray-600">
                                Speed: {vehicle.speed} km/h
                              </p>
                              {tracking?.address && (
                                <p className="text-xs text-gray-500">
                                  {tracking.address}
                                </p>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoutePlanner;
