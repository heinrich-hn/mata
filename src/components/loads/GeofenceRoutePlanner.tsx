import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import
  {
    AlertCircle,
    Building2,
    DollarSign,
    Flag,
    Fuel,
    MapPin,
    Navigation,
    Route as RouteIcon,
    Timer,
    TrendingUp,
  } from "lucide-react";
import { useEffect, useState } from "react";

interface Geofence {
  id: string;
  name: string;
  description: string | null;
  type: string;
  center_lat: number;
  center_lng: number;
  radius: number | null;
  color: string | null;
  metadata: unknown | null; // Use unknown to match Json type from database
  distFromOrigin?: number;
  distFromDest?: number;
  distFromRoute?: number;
}

interface GeofenceCategory {
  tollGates: Geofence[];
  borderPosts: Geofence[];
  weighBridges: Geofence[];
  restStops: Geofence[];
  depots: Geofence[];
  other: Geofence[];
}

interface GeofenceRoutePlannerProps {
  loadId: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  onGeofencesFound?: (geofences: Geofence[]) => void;
}

export const GeofenceRoutePlanner = ({
  loadId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  onGeofencesFound,
}: GeofenceRoutePlannerProps) => {
  const [selectedGeofences, setSelectedGeofences] = useState<Set<string>>(new Set());
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(true);

  // Calculate bounding box with buffer (50km each direction)
  const bufferDegrees = 0.5; // ~50km
  const bounds = {
    minLat: Math.min(originLat, destinationLat) - bufferDegrees,
    maxLat: Math.max(originLat, destinationLat) + bufferDegrees,
    minLng: Math.min(originLng, destinationLng) - bufferDegrees,
    maxLng: Math.max(originLng, destinationLng) + bufferDegrees,
  };

  // Fetch geofences along the route
  const { data: geofences = [], isLoading, error } = useQuery<Geofence[], Error>({
    queryKey: ["route-geofences", loadId, bounds],
    queryFn: fetchGeofences,
  });

  // Fetching geofences from the database
  async function fetchGeofences(): Promise<Geofence[]> {
    const { data, error } = await supabase
      .from("geofences")
      .select("*")
      .not("center_lat", "is", null)
      .not("center_lng", "is", null)
      .eq("is_active", true)
      .gte("center_lat", bounds.minLat)
      .lte("center_lat", bounds.maxLat)
      .gte("center_lng", bounds.minLng)
      .lte("center_lng", bounds.maxLng);

    if (error) throw error;

    // Cast to any to handle Json type from database, then enrich
    return (data || []).map((gf) => enrichGeofence(gf as Geofence));
  }

  // Enrich geofences with distance calculations
  const enrichGeofence = (gf: Geofence): Geofence => {
    return {
      ...gf,
      distFromOrigin: calculateDistance(originLat, originLng, gf.center_lat, gf.center_lng),
      distFromDest: calculateDistance(destinationLat, destinationLng, gf.center_lat, gf.center_lng),
      distFromRoute: calculatePerpendicularDistance(
        originLat, originLng,
        destinationLat, destinationLng,
        gf.center_lat, gf.center_lng
      ),
    };
  };

  // Distance calculation using the Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Perpendicular distance from a point to a line
  const calculatePerpendicularDistance = (x1: number, y1: number, x2: number, y2: number, px: number, py: number) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return calculateDistance(px, py, xx, yy);
  };

  // Notify parent of found geofences
  useEffect(() => {
    if (geofences.length > 0 && onGeofencesFound) {
      onGeofencesFound(geofences);
    }
  }, [geofences, onGeofencesFound]);

  // Auto-select relevant geofences
  useEffect(() => {
    if (geofences.length > 0) {
      const autoSelect = new Set<string>();

      geofences.forEach((gf) => {
        const isCritical = /toll|border|weigh/i.test(gf.description || "");
        const isNearRoute = (gf.distFromRoute ?? 999) < 25;

        if (isCritical && isNearRoute) {
          autoSelect.add(gf.id);
        }
      });

      setSelectedGeofences(autoSelect);
    }
  }, [geofences]);

  // Categorize geofences into types
  const categorizeGeofences = (): GeofenceCategory => {
    const categories: GeofenceCategory = {
      tollGates: [],
      borderPosts: [],
      weighBridges: [],
      restStops: [],
      depots: [],
      other: [],
    };

    geofences.forEach((gf) => {
      const desc = gf.description?.toLowerCase() || "";
      if (desc.includes("toll")) categories.tollGates.push(gf);
      else if (desc.includes("border")) categories.borderPosts.push(gf);
      else if (desc.includes("weigh")) categories.weighBridges.push(gf);
      else if (desc.includes("truck stop") || desc.includes("rest")) categories.restStops.push(gf);
      else if (desc.includes("warehouse") || desc.includes("depot")) categories.depots.push(gf);
      else categories.other.push(gf);
    });

    return categories;
  };

  // Calculate metrics
  const calculateStats = () => {
    const directDistance = calculateDistance(originLat, originLng, destinationLat, destinationLng);
    const selectedGfArray = geofences.filter((gf) => selectedGeofences.has(gf.id));

    // Estimate total distance
    let totalDistance = directDistance * 1.2;
    selectedGfArray.forEach((gf) => {
      totalDistance += (gf.distFromRoute ?? 0) * 0.5; // Add half detour distance
    });

    const avgSpeed = 80; // km/h
    const drivingTime = totalDistance / avgSpeed;

    // Additional delays due to tolls and borders
    const tollDelay = selectedGfArray.filter((gf) => gf.description?.toLowerCase().includes("toll")).length * 0.17;
    const borderDelay = selectedGfArray.filter((gf) => gf.description?.toLowerCase().includes("border")).length * 2;

    const totalTime = drivingTime + tollDelay + borderDelay;

    // Cost calculations
    const fuelConsumption = totalDistance * 0.3; // 0.3L/km
    const fuelCostPerLiter = 22; // ZAR
    const fuelCost = fuelConsumption * fuelCostPerLiter;

    const tollCount = selectedGfArray.filter((gf) => gf.description?.toLowerCase().includes("toll")).length;
    const avgTollCost = 150; // ZAR per toll
    const tollCost = tollCount * avgTollCost;

    return {
      directDistance: Math.round(directDistance),
      totalDistance: Math.round(totalDistance),
      drivingTime: Math.round(drivingTime * 10) / 10,
      totalTime: Math.round(totalTime * 10) / 10,
      fuelConsumption: Math.round(fuelConsumption),
      fuelCost: Math.round(fuelCost),
      tollCost,
      totalCost: Math.round(fuelCost + tollCost),
      waypointCount: selectedGfArray.length,
    };
  };

  const stats = calculateStats();
  const categories = categorizeGeofences();

  // Filter geofences if "show only relevant" is enabled
  const displayGeofences = showOnlyRelevant
    ? geofences.filter((gf) => (gf.distFromRoute ?? 999) < 50)
    : geofences;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load geofences: {(error as Error).message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalDistance} km</p>
            <p className="text-xs text-gray-500">Direct: {stats.directDistance} km</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalTime}h</p>
            <p className="text-xs text-gray-500">Driving: {stats.drivingTime}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              Fuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.fuelConsumption}L</p>
            <p className="text-xs text-gray-500">R {stats.fuelCost}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R {stats.totalCost}</p>
            <p className="text-xs text-gray-500">Tolls: R {stats.tollCost}</p>
          </CardContent>
        </Card>
      </div>

      {/* Geofences List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geofences Along Route ({displayGeofences.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-relevant"
                checked={showOnlyRelevant}
                onCheckedChange={(checked) => setShowOnlyRelevant(!!checked)}
              />
              <label htmlFor="show-relevant" className="text-sm cursor-pointer">Show only relevant (within 50km)</label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500 py-4">Loading geofences...</p>
          ) : displayGeofences.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No geofences found along this route.</p>
          ) : (
            <div className="space-y-4">
              {/* Critical Waypoints */}
              {(categories.tollGates.length > 0 || categories.borderPosts.length > 0) && (
                <WaypointSection title="Critical Waypoints" icon={Flag} geofences={[...categories.tollGates, ...categories.borderPosts]} />
              )}

              {/* Rest Stops & Depots */}
              {(categories.restStops.length > 0 || categories.depots.length > 0) && (
                <WaypointSection title="Optional Stops" icon={Building2} geofences={[...categories.restStops, ...categories.depots]} />
              )}

              {/* Other Locations */}
              {categories.other.length > 0 && !showOnlyRelevant && (
                <WaypointSection title="Other Nearby" icon={TrendingUp} geofences={categories.other} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <RouteIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Route Plan Summary</p>
              <p className="text-sm text-blue-800 mt-1">
                {selectedGeofences.size} waypoints selected • {stats.totalDistance} km • {stats.totalTime}h travel time • R {stats.totalCost} estimated cost
              </p>
              {categories.borderPosts.filter((gf) => selectedGeofences.has(gf.id)).length > 0 && (
                <p className="text-xs text-blue-700 mt-2">⚠️ Route crosses international border - ensure customs documents are ready</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper component to display geofences in sections
const WaypointSection = ({ title, icon: Icon, geofences }) => (
  <div>
    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-red-500" />
      {title}
    </h4>
    <div className="space-y-2">
      {geofences.map((gf) => (
        <GeofenceItem key={gf.id} geofence={gf} />
      ))}
    </div>
  </div>
);

// Helper component to render individual geofences
const GeofenceItem = ({ geofence }) => (
  <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50">
    <Checkbox checked={false} />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">{getGeofenceIcon(geofence)}</span>
        <p className="font-medium">{geofence.name}</p>
        {geofence.description?.toLowerCase().includes("border") && (
          <Badge variant="destructive" className="text-xs">~2h delay</Badge>
        )}
      </div>
      {geofence.description && (
        <p className="text-sm text-gray-600 mt-1">{geofence.description}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        {Math.round(geofence.distFromOrigin ?? 0)} km from origin • {Math.round(geofence.distFromRoute ?? 0)} km off route
      </p>
    </div>
  </div>
);

// Function to get the icon for geofences
const getGeofenceIcon = (gf: Geofence) => {
  const desc = gf.description?.toLowerCase() || "";
  if (desc.includes("toll")) return "💰";
  if (desc.includes("border")) return "🛂";
  if (desc.includes("weigh")) return "⚖️";
  if (desc.includes("hospital")) return "🏥";
  if (desc.includes("depot")) return "🏢";
  if (desc.includes("truck stop")) return "⛽";
  return "📍";
};

export default GeofenceRoutePlanner;
