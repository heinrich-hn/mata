import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  formatLastConnected,
  type TelematicsAsset,
} from "@/lib/telematicsGuru";
import type { ActiveLoadForTracking } from "@/lib/api";
import { DEPOTS } from "@/lib/depots";
import { useGeofenceEvents, type GeofenceEvent as DbGeofenceEvent } from "@/hooks/useGeofenceEvents";
import {
  MapPin,
  Route,
  Truck,
  Timer,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadTimelineEvent {
  type: string;
  label: string;
  time: string | null | undefined;
  source: string | null | undefined;
  verified: boolean;
  icon: typeof ArrowDownToLine;
  color: string;
}

interface LoadWithTimes {
  id: string;
  load_id: string;
  origin: string;
  destination: string;
  status: string;
  loading_date?: string;
  offloading_date?: string;
  actual_loading_arrival?: string | null;
  actual_loading_arrival_source?: string | null;
  actual_loading_arrival_verified?: boolean;
  actual_loading_departure?: string | null;
  actual_loading_departure_source?: string | null;
  actual_loading_departure_verified?: boolean;
  actual_offloading_arrival?: string | null;
  actual_offloading_arrival_source?: string | null;
  actual_offloading_arrival_verified?: boolean;
  actual_offloading_departure?: string | null;
  actual_offloading_departure_source?: string | null;
  actual_offloading_departure_verified?: boolean;
}

interface TripHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: TelematicsAsset | null;
  activeLoad?: ActiveLoadForTracking | null;
  vehicleLoads?: LoadWithTimes[];
  organisationId?: number | null;
}

// ---------------------------------------------------------------------------
// Waypoint Data & Helpers
// ---------------------------------------------------------------------------

interface Waypoint {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Lazy-load waypoints data to avoid build errors if file doesn't exist
let waypoints: Waypoint[] = [];

async function loadWaypoints(): Promise<Waypoint[]> {
  if (waypoints.length > 0) return waypoints;

  try {
    // Try to import the JSON file dynamically
    const module = await import('@/waypoints-zones-geofences.json');
    waypoints = (module.default || module) as Waypoint[];
    console.log(`✅ Loaded ${waypoints.length} waypoints from JSON file`);
    return waypoints;
  } catch (error) {
    console.warn('⚠️ Could not load waypoints JSON file, using fallback data', error);
    // Fallback waypoints data - add your known depots here
    waypoints = getFallbackWaypoints();
    console.log(`✅ Loaded ${waypoints.length} fallback waypoints`);
    return waypoints;
  }
}

/**
 * Fallback waypoints in case the JSON file can't be loaded.
 * Add your known depots and locations here.
 */
function getFallbackWaypoints(): Waypoint[] {
  return [
    {
      name: "Bulawayo Depot",
      address: "Bulawayo, Zimbabwe",
      latitude: -20.1500,
      longitude: 28.5833,
    },
    {
      name: "BV",
      address: "Beitbridge, Zimbabwe",
      latitude: -22.2167,
      longitude: 30.0000,
    },
    {
      name: "BV Depot",
      address: "Beitbridge Depot, Zimbabwe",
      latitude: -22.2167,
      longitude: 30.0000,
    },
    {
      name: "Harare Depot",
      address: "Harare, Zimbabwe",
      latitude: -17.8252,
      longitude: 31.0335,
    },
    {
      name: "Johannesburg Depot",
      address: "Johannesburg, South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
    },
    // Add more waypoints as needed based on your waypoints-zones-geofences.json content
  ];
}

/**
 * Find waypoint coordinates by name using fuzzy matching.
 * Searches through known waypoints/depots to match location names.
 */
async function findWaypointCoordinates(locationName: string): Promise<{ lat: number; lng: number } | null> {
  if (!locationName) return null;

  const normalizedSearch = locationName.toLowerCase().trim();

  // 1. Check canonical DEPOTS first — these contain authoritative coords for
  //    short-code locations like "BV", "CBC" that don't appear in the waypoints JSON.
  const depotMatch =
    DEPOTS.find((d) => d.name.toLowerCase() === normalizedSearch) ||
    DEPOTS.find((d) => d.name.toLowerCase().includes(normalizedSearch)) ||
    DEPOTS.find((d) => normalizedSearch.includes(d.name.toLowerCase()));
  if (depotMatch) {
    console.log(`📍 Found depot match: "${locationName}" → "${depotMatch.name}" (${depotMatch.latitude}, ${depotMatch.longitude})`);
    return { lat: depotMatch.latitude, lng: depotMatch.longitude };
  }

  const allWaypoints = await loadWaypoints();

  // Try exact match first
  let match = allWaypoints.find(
    w => w.name.toLowerCase() === normalizedSearch
  );

  // Try the name contains the search term
  if (!match) {
    match = allWaypoints.find(
      w => w.name.toLowerCase().includes(normalizedSearch)
    );
  }

  // Try the search term contains the waypoint name  
  if (!match) {
    match = allWaypoints.find(
      w => normalizedSearch.includes(w.name.toLowerCase())
    );
  }

  // Try matching individual words
  if (!match) {
    const searchWords = normalizedSearch.split(/[\s,]+/).filter(w => w.length > 1);
    for (const word of searchWords) {
      match = allWaypoints.find(w => w.name.toLowerCase().includes(word));
      if (match) break;
    }
  }

  if (match) {
    console.log(`📍 Found waypoint match: "${locationName}" → "${match.name}" (${match.latitude}, ${match.longitude})`);
    return { lat: match.latitude, lng: match.longitude };
  }

  console.log(`⚠️ No waypoint match found for: "${locationName}"`);
  return null;
}

/**
 * Geocode an address string to coordinates.
 * First tries local waypoints database, then falls back to Nominatim if needed.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address) return null;

  // First, try our local waypoints database
  const localResult = await findWaypointCoordinates(address);
  if (localResult) {
    return localResult;
  }

  // Fallback to Nominatim geocoding
  try {
    console.log(`🌐 Geocoding via Nominatim: "${address}"`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FleetTrackingApp/1.0'
        }
      }
    );

    if (!response.ok) return null;
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Nominatim geocoding failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm");
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Map Component
// ---------------------------------------------------------------------------

interface LoadMapProps {
  origin: string;
  destination: string;
}

function FitBounds({ origin, destination }: { origin: [number, number] | null; destination: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const points: L.LatLngTuple[] = [];
    if (origin) points.push(origin);
    if (destination) points.push(destination);

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, origin, destination]);

  return null;
}

function LoadMap({ origin, destination }: LoadMapProps) {
  const [coords, setCoords] = useState<{
    origin: [number, number] | null;
    destination: [number, number] | null;
  }>({ origin: null, destination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCoords = async () => {
      setLoading(true);
      setError(null);

      try {
        const [originResult, destResult] = await Promise.all([
          geocodeAddress(origin),
          geocodeAddress(destination),
        ]);

        if (!originResult && !destResult) {
          setError(`Could not find coordinates for "${origin}" or "${destination}"`);
        }

        setCoords({
          origin: originResult ? [originResult.lat, originResult.lng] : null,
          destination: destResult ? [destResult.lat, destResult.lng] : null,
        });
      } catch (err) {
        console.error('Error loading map coordinates:', err);
        setError('Failed to load map');
      } finally {
        setLoading(false);
      }
    };

    if (origin && destination) {
      fetchCoords();
    } else {
      setLoading(false);
      setError('Origin and destination required');
    }
  }, [origin, destination]);

  const hasValidCoords = coords.origin || coords.destination;

  if (loading) {
    return (
      <div className="h-[200px] bg-slate-100 rounded-lg flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading map...</span>
      </div>
    );
  }

  if (!hasValidCoords) {
    return (
      <div className="h-[200px] bg-slate-100 rounded-lg flex flex-col items-center justify-center">
        <MapPin className="h-6 w-6 text-slate-400 mb-1" />
        <p className="text-sm text-slate-500">Location unavailable</p>
        {error && <p className="text-xs text-slate-400 mt-1">{error}</p>}
      </div>
    );
  }

  const defaultCenter: [number, number] = coords.origin || coords.destination || [0, 0];

  return (
    <div className="h-[200px] rounded-lg overflow-hidden border mb-4">
      <MapContainer
        center={defaultCenter}
        zoom={10}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {coords.origin && (
          <>
            <Marker position={coords.origin}>
              <Popup>
                <div className="text-sm font-medium">Origin</div>
                <div className="text-xs text-muted-foreground">{origin}</div>
              </Popup>
            </Marker>
            <Circle
              center={coords.origin}
              radius={200}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1 }}
            />
          </>
        )}

        {coords.destination && (
          <>
            <Marker position={coords.destination}>
              <Popup>
                <div className="text-sm font-medium">Destination</div>
                <div className="text-xs text-muted-foreground">{destination}</div>
              </Popup>
            </Marker>
            <Circle
              center={coords.destination}
              radius={200}
              pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.1 }}
            />
          </>
        )}

        {coords.origin && coords.destination && (
          <Polyline
            positions={[coords.origin, coords.destination]}
            pathOptions={{
              color: "#8b5cf6",
              weight: 3,
              opacity: 0.8,
              dashArray: "5, 5"
            }}
          />
        )}

        <FitBounds origin={coords.origin} destination={coords.destination} />
      </MapContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GeofenceTimeline component
// ---------------------------------------------------------------------------

function GeofenceTimeline({ load }: { load: LoadWithTimes }) {
  const events: LoadTimelineEvent[] = [
    {
      type: "loading_arrival",
      label: `Arrived at ${load.origin || "Origin"}`,
      time: load.actual_loading_arrival,
      source: load.actual_loading_arrival_source,
      verified: !!load.actual_loading_arrival_verified,
      icon: ArrowDownToLine,
      color: "text-blue-600",
    },
    {
      type: "loading_departure",
      label: `Departed ${load.origin || "Origin"}`,
      time: load.actual_loading_departure,
      source: load.actual_loading_departure_source,
      verified: !!load.actual_loading_departure_verified,
      icon: ArrowUpFromLine,
      color: "text-indigo-600",
    },
    {
      type: "offloading_arrival",
      label: `Arrived at ${load.destination || "Destination"}`,
      time: load.actual_offloading_arrival,
      source: load.actual_offloading_arrival_source,
      verified: !!load.actual_offloading_arrival_verified,
      icon: ArrowDownToLine,
      color: "text-emerald-600",
    },
    {
      type: "offloading_departure",
      label: `Departed ${load.destination || "Destination"}`,
      time: load.actual_offloading_departure,
      source: load.actual_offloading_departure_source,
      verified: !!load.actual_offloading_departure_verified,
      icon: ArrowUpFromLine,
      color: "text-green-700",
    },
  ];

  const loadingDwell =
    load.actual_loading_arrival && load.actual_loading_departure
      ? formatDistanceStrict(new Date(load.actual_loading_arrival), new Date(load.actual_loading_departure))
      : null;

  const offloadingDwell =
    load.actual_offloading_arrival && load.actual_offloading_departure
      ? formatDistanceStrict(new Date(load.actual_offloading_arrival), new Date(load.actual_offloading_departure))
      : null;

  const transitTime =
    load.actual_loading_departure && load.actual_offloading_arrival
      ? formatDistanceStrict(new Date(load.actual_loading_departure), new Date(load.actual_offloading_arrival))
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Route className="h-4 w-4 text-purple-600" />
        <span>{load.load_id}: {load.origin} → {load.destination}</span>
        <span className={cn(
          "px-1.5 py-0.5 rounded text-xs font-medium",
          load.status === "delivered" ? "bg-green-100 text-green-700"
            : load.status === "in-transit" ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600",
        )}>
          {load.status}
        </span>
      </div>

      {/* Map showing the route */}
      <LoadMap origin={load.origin} destination={load.destination} />

      {/* Timeline events */}
      <div className="relative ml-4 border-l-2 border-muted pl-6 space-y-4">
        {events.map((event) => {
          const Icon = event.icon;
          const hasTime = !!event.time;
          return (
            <div key={event.type} className="relative">
              <div className={cn(
                "absolute -left-[31px] w-4 h-4 rounded-full border-2 flex items-center justify-center",
                hasTime ? "bg-white border-current" : "bg-muted border-muted-foreground/30",
                event.color,
              )}>
                {hasTime && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
              </div>
              <div className="flex items-start gap-2">
                <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", hasTime ? event.color : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", !hasTime && "text-muted-foreground")}>{event.label}</p>
                  {hasTime ? (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-sm text-muted-foreground">{formatDateTime(event.time)}</span>
                      <span className={cn(
                        "text-xs px-1 py-0.5 rounded",
                        event.source === "auto" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600",
                      )}>
                        {event.source === "auto" ? "GPS" : "Manual"}
                      </span>
                      {event.verified && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                  )}
                </div>
              </div>
              {event.type === "loading_departure" && loadingDwell && (
                <div className="ml-6 mt-1 text-xs text-muted-foreground">
                  <Timer className="inline h-3 w-3 mr-1" />Loading dwell: {loadingDwell}
                </div>
              )}
              {event.type === "loading_departure" && transitTime && (
                <div className="ml-6 mt-1 text-xs text-blue-600">
                  <Truck className="inline h-3 w-3 mr-1" />Transit: {transitTime}
                </div>
              )}
              {event.type === "offloading_departure" && offloadingDwell && (
                <div className="ml-6 mt-1 text-xs text-muted-foreground">
                  <Timer className="inline h-3 w-3 mr-1" />Offloading dwell: {offloadingDwell}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geofence Event Log Item
// ---------------------------------------------------------------------------

function GeofenceEventItem({ event }: { event: DbGeofenceEvent }) {
  const EVENT_CONFIG: Record<string, { label: string; icon: typeof MapPin; color: string }> = {
    loading_arrival: { label: "Entered Loading Zone", icon: MapPin, color: "text-blue-600" },
    loading_departure: { label: "Exited Loading Zone", icon: MapPin, color: "text-indigo-600" },
    offloading_arrival: { label: "Entered Offloading Zone", icon: MapPin, color: "text-emerald-600" },
    offloading_departure: { label: "Exited Offloading Zone", icon: MapPin, color: "text-green-700" },
  };

  const config = EVENT_CONFIG[event.event_type] || {
    label: event.event_type,
    icon: MapPin,
    color: "text-gray-600",
  };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-2">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        event.event_type.includes("arrival") ? "bg-blue-50" : "bg-green-50",
      )}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{config.label}</p>
          <span className={cn(
            "text-xs px-1 py-0.5 rounded",
            event.source === "auto" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600",
          )}>
            {event.source === "auto" ? "GPS" : "Manual"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Clock className="h-3 w-3" />
          <span>{formatDateTime(event.event_time)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          {event.geofence_name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.geofence_name}
            </span>
          )}
          {event.load_number && (
            <span className="flex items-center gap-1">
              <Route className="h-3 w-3" />
              {event.load_number}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function TripHistoryDialog({
  open,
  onOpenChange,
  asset,
  vehicleLoads = [],
}: TripHistoryDialogProps) {
  // Fetch geofence events from database
  const assetIdStr = asset?.id ? String(asset.id) : null;
  const vehicleName = asset?.name || asset?.code || "";
  const { data: eventsData, isLoading: eventsLoading } = useGeofenceEvents(
    vehicleName,
    assetIdStr,
    100,
  );
  const geofenceEvents = useMemo(
    () => eventsData?.events ?? [],
    [eventsData],
  );

  // Sort loads by most recent activity
  const sortedLoads = useMemo(() => {
    return [...vehicleLoads].sort((a, b) => {
      const aTime = a.actual_loading_arrival || a.loading_date || "";
      const bTime = b.actual_loading_arrival || b.loading_date || "";
      return bTime.localeCompare(aTime);
    });
  }, [vehicleLoads]);

  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  // Auto-select the most recent active/in-transit load when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedLoadId(null);
      return;
    }
    if (sortedLoads.length === 0) return;
    const active = sortedLoads.find((l) => l.status === "in-transit" || l.status === "scheduled");
    setSelectedLoadId(active?.id || sortedLoads[0].id);
  }, [open, sortedLoads]);

  const selectedLoad = useMemo(
    () => sortedLoads.find((l) => l.id === selectedLoadId) ?? null,
    [sortedLoads, selectedLoadId],
  );

  // Filter loads to show only the selected one, or all if none selected
  const displayLoads = selectedLoad
    ? sortedLoads.filter(l => l.id === selectedLoad.id)
    : sortedLoads;

  // Group events by date
  const eventsByDate = useMemo(() => {
    const groups = new Map<string, DbGeofenceEvent[]>();
    for (const event of geofenceEvents) {
      try {
        const dateKey = format(new Date(event.event_time), "dd MMM yyyy");
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey)!.push(event);
      } catch {
        // skip malformed dates
      }
    }
    return groups;
  }, [geofenceEvents]);

  const displayVehicleName = asset?.name || asset?.code || `Vehicle ${asset?.id}`;

  // Determine if we have any data to show
  const hasLoadData = sortedLoads.some(
    (l) => l.actual_loading_arrival || l.actual_loading_departure ||
      l.actual_offloading_arrival || l.actual_offloading_departure,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {displayVehicleName} — Trip History
          </DialogTitle>
          <DialogDescription className="sr-only">
            Geofence entry and exit history for {displayVehicleName}
          </DialogDescription>
          {asset && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span>{Math.round(asset.speedKmH)} km/h</span>
              <span>•</span>
              <span>{asset.inTrip ? "Moving" : "Parked"}</span>
              <span>•</span>
              <span>Last seen: {formatLastConnected(asset.lastConnectedUtc)}</span>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Load selector */}
            {sortedLoads.length > 1 && (
              <div className="px-1">
                {/* Use empty string (not undefined) when no selection so Radix Select stays controlled
                    across the brief render before the auto-select effect runs. */}
                <Select value={selectedLoadId ?? ""} onValueChange={setSelectedLoadId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select trip" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedLoads.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        <span className="font-medium">{l.load_id}</span>
                        <span className="text-muted-foreground ml-2">
                          {l.origin} → {l.destination}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Section 1: Load-based Geofence Entry/Exit Times */}
            {sortedLoads.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Geofence Entry & Exit Times (by Load)
                </h3>
                {hasLoadData ? (
                  <div className="space-y-6">
                    {displayLoads.map((load) => (
                      <Card key={load.id} className="shadow-sm">
                        <CardContent className="pt-4 pb-3">
                          <GeofenceTimeline load={load} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                    <MapPin className="h-6 w-6 mx-auto mb-1 opacity-40" />
                    <p>No geofence events recorded yet for current loads.</p>
                    <p className="text-xs mt-1">Events are captured automatically when vehicles enter/exit depot geofences.</p>
                  </div>
                )}
              </div>
            )}

            {sortedLoads.length > 0 && geofenceEvents.length > 0 && <Separator />}

            {/* Section 2: Historical Geofence Event Log */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Geofence Event Log
              </h3>

              {eventsLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading event history...
                </div>
              )}

              {!eventsLoading && geofenceEvents.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                  <Clock className="h-6 w-6 mx-auto mb-1 opacity-40" />
                  <p>No geofence events recorded yet.</p>
                  <p className="text-xs mt-1">
                    Events will appear here as the geofence monitor detects vehicles entering and exiting depots.
                  </p>
                </div>
              )}

              {!eventsLoading && geofenceEvents.length > 0 && (
                <div className="space-y-4">
                  {Array.from(eventsByDate.entries()).map(([dateLabel, events]) => (
                    <div key={dateLabel}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 pl-1">
                        {dateLabel}
                      </p>
                      <div className="border rounded-lg divide-y">
                        {events.map((event) => (
                          <div key={event.id} className="px-3">
                            <GeofenceEventItem event={event} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* No data at all */}
            {sortedLoads.length === 0 && !eventsLoading && geofenceEvents.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No trip history available</p>
                <p className="text-xs mt-1">
                  This vehicle has no linked loads or recorded geofence events yet.
                  <br />
                  Events will be captured automatically as the vehicle travels between depots.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}