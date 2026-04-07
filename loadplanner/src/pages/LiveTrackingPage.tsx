import { TripHistoryDialog } from "@/components/tracking/TripHistoryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomLocations } from "@/hooks/useCustomLocations";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveLoadsForTracking,
  type ActiveLoadForTracking,
} from "@/lib/api";
import { calculateDistance, DEPOTS } from "@/lib/depots";
import { calculateRoadDistance, decodePolyline } from "@/lib/routing";
import {
  authenticate,
  clearAuth,
  formatLastConnected,
  getAssetsWithPositions,
  getGeofences,
  getStatusColor,
  isAuthenticated,
  type TelematicsAsset,
  type TelematicsGeofence,
} from "@/lib/telematicsGuru";
import { formatDistance } from "@/lib/waypoints";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  Polygon as LeafletPolygon,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { toast } from "sonner";

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

function calculateETA(
  vehicle: TelematicsAsset,
  geofence: TelematicsGeofence,
): {
  eta: Date | null;
  etaFormatted: string;
  distance: number;
  distanceFormatted: string;
  durationMinutes: number;
  durationFormatted: string;
  speed: number;
  isMoving: boolean;
} {
  const vehicleLat = vehicle.lastLatitude;
  const vehicleLng = vehicle.lastLongitude;
  const geofenceLat =
    geofence.latitude ?? geofence.centerLatitude ?? geofence.lat;
  const geofenceLng =
    geofence.longitude ?? geofence.centerLongitude ?? geofence.lng;

  if (!vehicleLat || !vehicleLng || !geofenceLat || !geofenceLng) {
    return {
      eta: null,
      etaFormatted: "N/A",
      distance: 0,
      distanceFormatted: "N/A",
      durationMinutes: 0,
      durationFormatted: "N/A",
      speed: vehicle.speedKmH || 0,
      isMoving: (vehicle.speedKmH || 0) > 0 || vehicle.inTrip,
    };
  }

  const distance = calculateDistance(
    vehicleLat,
    vehicleLng,
    geofenceLat,
    geofenceLng,
  );
  const distanceFormatted = formatDistance(distance);
  const speed = vehicle.speedKmH || 0;
  const isMoving = speed > 0 || vehicle.inTrip;
  const effectiveSpeed = isMoving ? Math.max(speed, 20) : 50;
  const durationMinutes = (distance / effectiveSpeed) * 60;
  const durationFormatted = formatDuration(durationMinutes);
  const now = new Date();
  const eta = new Date(now.getTime() + durationMinutes * 60000);
  const etaFormatted = eta.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    eta,
    etaFormatted,
    distance,
    distanceFormatted,
    durationMinutes,
    durationFormatted,
    speed: vehicle.speedKmH || 0,
    isMoving,
  };
}

// Professional vehicle marker with clean design
function createVehicleIcon(
  asset: TelematicsAsset,
  hasActiveLoad = false,
): L.DivIcon {
  const isMoving = asset.speedKmH >= 5;
  const color = isMoving ? "#16a34a" : "#dc2626";
  const rotation = asset.heading || 0;
  const fleetNumber = asset.name || asset.code || `${asset.id}`;
  const displayNumber =
    fleetNumber.length > 8 ? fleetNumber.substring(0, 7) + "…" : fleetNumber;

  // Stopped: plain red dot. Moving: green circle with directional arrow.
  const markerHtml = isMoving
    ? `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div style="
        width: 20px;
        height: 20px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${rotation}deg);
      ">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div style="
        position: absolute;
        top: 22px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        color: white;
        font-size: 9px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 3px;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.2;
      ">
        ${displayNumber}
      </div>
      ${hasActiveLoad ? `
      <div style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: #7c3aed;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1.5px solid white;
      "></div>
      ` : ''}
    </div>
  `
    : `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
      <div style="
        width: 14px;
        height: 14px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>
      <div style="
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        color: white;
        font-size: 9px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 3px;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.2;
      ">
        ${displayNumber}
      </div>
      ${hasActiveLoad ? `
      <div style="
        position: absolute;
        top: -4px;
        right: -4px;
        background: #7c3aed;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 1.5px solid white;
      "></div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html: markerHtml,
    className: "vehicle-marker",
    iconSize: isMoving ? [28, 36] : [22, 30],
    iconAnchor: isMoving ? [14, 18] : [11, 15],
    popupAnchor: [0, isMoving ? -18 : -15],
  });
}

// Depot marker with professional styling
function createDepotIcon(type: string): L.DivIcon {
  const colors: Record<string, string> = {
    depot: "#059669",
    warehouse: "#0284c7",
    market: "#dc2626",
    default: "#9333ea",
  };
  const color = colors[type] || colors.default;

  return L.divIcon({
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border-radius: 8px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9L12 3L21 9L12 15L3 9Z" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.3)"/>
          <path d="M12 15V21M8 18H16" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    className: "depot-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Custom location marker
const createCustomLocationIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div style="
        width: 26px;
        height: 26px;
        background: #f97316;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.3)"/>
          <circle cx="12" cy="12" r="3" fill="white"/>
        </svg>
      </div>
    `,
    className: "custom-location-marker",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

function FitBounds({ assets }: { assets: TelematicsAsset[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !map.getContainer()) return;

    const timeoutId = setTimeout(() => {
      if (assets.length === 0) return;

      const validAssets = assets.filter(
        (a) => a.lastLatitude !== null && a.lastLongitude !== null,
      );
      if (validAssets.length === 0) return;

      try {
        const bounds = L.latLngBounds(
          validAssets.map((a) => [a.lastLatitude!, a.lastLongitude!]),
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (error) {
        console.warn('FitBounds error:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [assets, map]);

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export default function LiveTrackingPage() {
  const [assets, setAssets] = useState<TelematicsAsset[]>([]);
  const [activeLoads, setActiveLoads] = useState<ActiveLoadForTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [_refreshInterval, _setRefreshInterval] = useState(10);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [geofences, setGeofences] = useState<TelematicsGeofence[]>([]);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const { data: customLocations = [] } = useCustomLocations();
  const [maximizeMap, setMaximizeMap] = useState(false);
  const [showRouteCalculator, setShowRouteCalculator] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<number | null>(
    null,
  );
  const [etaResult, setEtaResult] = useState<{
    eta: Date | null;
    etaFormatted: string;
    distance: number;
    distanceFormatted: string;
    durationMinutes: number;
    durationFormatted: string;
    speed: number;
    isMoving: boolean;
  } | null>(null);

  // Trip history dialog state
  const [tripHistoryAsset, setTripHistoryAsset] = useState<TelematicsAsset | null>(null);
  const [tripHistoryLoads, setTripHistoryLoads] = useState<Record<string, unknown>[]>([]);

  // Auth form state
  const [username, setUsername] = useState(
    localStorage.getItem("tg_username") || "",
  );
  const [password, setPassword] = useState("");
  const [organisationId, setOrganisationId] = useState(
    localStorage.getItem("telematics_org_id") || "4002",
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem("tg_remember") === "true",
  );

  // Auto-authenticate on mount
  useEffect(() => {
    const autoLogin = async () => {
      if (isAuthenticated()) {
        setAuthenticated(true);
        return;
      }

      const savedUsername = localStorage.getItem("tg_username");
      const savedPassword = localStorage.getItem("tg_password");
      const savedRemember = localStorage.getItem("tg_remember") === "true";

      if (savedRemember && savedUsername && savedPassword) {
        setAuthLoading(true);
        const success = await authenticate(savedUsername, atob(savedPassword));
        if (success) {
          setAuthenticated(true);
        } else {
          localStorage.removeItem("tg_password");
          localStorage.removeItem("tg_remember");
          setRememberMe(false);
          setShowAuthDialog(true);
        }
        setAuthLoading(false);
      } else if (!isAuthenticated()) {
        setShowAuthDialog(true);
      }
    };

    autoLogin();
  }, []);

  const fetchAssets = useCallback(async () => {
    if (!authenticated || !organisationId) return;

    setLoading(true);
    setError(null);

    try {
      const [telematicsData, loadsResponse, geofenceData] = await Promise.all([
        getAssetsWithPositions(parseInt(organisationId)),
        getActiveLoadsForTracking().catch(() => ({
          data: { activeLoads: [] },
        })),
        getGeofences(parseInt(organisationId)).catch(() => []),
      ]);

      setAssets(telematicsData);
      setActiveLoads(loadsResponse.data?.activeLoads || []);
      setGeofences(geofenceData || []);
      setLastRefresh(new Date());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch vehicles";
      setError(message);
      toast.error(message);
      if (message.includes("Authentication") || message.includes("expired")) {
        setAuthenticated(false);
        setShowAuthDialog(true);
      }
    } finally {
      setLoading(false);
    }
  }, [authenticated, organisationId]);

  const assetToLoadMap = useMemo(() => {
    const map = new Map<string | number, ActiveLoadForTracking>();
    activeLoads.forEach((load) => {
      if (load.vehicle?.telematicsAssetId) {
        map.set(load.vehicle.telematicsAssetId, load);
      }
      if (load.vehicle?.registration) {
        map.set(load.vehicle.registration.toLowerCase(), load);
      }
    });
    return map;
  }, [activeLoads]);

  const getLoadForAsset = useCallback(
    (asset: TelematicsAsset): ActiveLoadForTracking | null => {
      if (assetToLoadMap.has(asset.id)) {
        return assetToLoadMap.get(asset.id)!;
      }
      const assetName = (asset.name || asset.code || "").toLowerCase();
      if (assetName && assetToLoadMap.has(assetName)) {
        return assetToLoadMap.get(assetName)!;
      }
      return null;
    },
    [assetToLoadMap],
  );

  const openTripHistory = useCallback(async (asset: TelematicsAsset) => {
    setTripHistoryAsset(asset);
    try {
      const assetName = (asset.name || asset.code || "").toLowerCase();
      const { data } = await supabase
        .from("loads")
        .select(`
          id, load_id, origin, destination, status, loading_date, offloading_date,
          actual_loading_arrival, actual_loading_arrival_source, actual_loading_arrival_verified,
          actual_loading_departure, actual_loading_departure_source, actual_loading_departure_verified,
          actual_offloading_arrival, actual_offloading_arrival_source, actual_offloading_arrival_verified,
          actual_offloading_departure, actual_offloading_departure_source, actual_offloading_departure_verified,
          fleet_vehicle:fleet_vehicles(id, vehicle_id, telematics_asset_id)
        `)
        .order("loading_date", { ascending: false })
        .limit(20);

      const vehicleLoads = (data || []).filter((load) => {
        const fv = load.fleet_vehicle as { telematics_asset_id?: string | null; vehicle_id?: string } | null;
        if (fv?.telematics_asset_id && String(fv.telematics_asset_id) === String(asset.id)) return true;
        if (fv?.vehicle_id && fv.vehicle_id.toLowerCase() === assetName) return true;
        return false;
      });
      setTripHistoryLoads(vehicleLoads as Record<string, unknown>[]);
    } catch {
      setTripHistoryLoads([]);
    }
  }, []);

  const selectedVehicle = useMemo(
    () => assets.find((a) => a.id === selectedVehicleId),
    [assets, selectedVehicleId],
  );

  const selectedGeofence = useMemo(
    () => geofences.find((g) => g.id === selectedGeofenceId),
    [geofences, selectedGeofenceId],
  );

  useEffect(() => {
    if (!selectedVehicle || !selectedGeofence) {
      setEtaResult(null);
      return;
    }

    const result = calculateETA(selectedVehicle, selectedGeofence);
    setEtaResult(result);
  }, [selectedVehicle, selectedGeofence]);

  const handleAuth = async () => {
    if (!username || !password || !organisationId) return;

    setAuthLoading(true);
    setError(null);

    const success = await authenticate(username, password);

    if (success) {
      localStorage.setItem("telematics_org_id", organisationId);
      localStorage.setItem("tg_username", username);

      if (rememberMe) {
        localStorage.setItem("tg_password", btoa(password));
        localStorage.setItem("tg_remember", "true");
      } else {
        localStorage.removeItem("tg_password");
        localStorage.removeItem("tg_remember");
      }

      setAuthenticated(true);
      setShowAuthDialog(false);
      setPassword("");
      toast.success("Connected to Telematics Guru");
    } else {
      setError("Invalid credentials");
      toast.error("Invalid credentials");
    }

    setAuthLoading(false);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthenticated(false);
    setAssets([]);
    setUsername("");
    setOrganisationId("");
    setRememberMe(false);
    localStorage.removeItem("telematics_org_id");
    localStorage.removeItem("tg_username");
    localStorage.removeItem("tg_password");
    localStorage.removeItem("tg_remember");
    toast.success("Disconnected from Telematics");
  };

  useEffect(() => {
    if (authenticated && organisationId) {
      fetchAssets();
    }
  }, [authenticated, organisationId, fetchAssets]);

  useEffect(() => {
    if (!autoRefresh || !authenticated) return;

    const intervalId = setInterval(fetchAssets, _refreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, authenticated, _refreshInterval, fetchAssets]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!selectedVehicle?.lastLatitude || !selectedVehicle?.lastLongitude || !selectedGeofence) {
        setRouteCoords([]);
        return;
      }

      const destLat = selectedGeofence.centerLatitude ?? selectedGeofence.latitude ?? selectedGeofence.lat;
      const destLng = selectedGeofence.centerLongitude ?? selectedGeofence.longitude ?? selectedGeofence.lng;

      if (!destLat || !destLng) {
        setRouteCoords([]);
        return;
      }

      try {
        const result = await calculateRoadDistance(
          selectedVehicle.lastLatitude,
          selectedVehicle.lastLongitude,
          destLat,
          destLng
        );

        if (result.geometry) {
          const coords = decodePolyline(result.geometry);
          setRouteCoords(coords);
        } else {
          setRouteCoords([
            [selectedVehicle.lastLatitude, selectedVehicle.lastLongitude],
            [destLat, destLng]
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch road route:', err);
        if (destLat && destLng) {
          setRouteCoords([
            [selectedVehicle.lastLatitude, selectedVehicle.lastLongitude],
            [destLat, destLng]
          ]);
        }
      }
    };

    fetchRoute();
  }, [selectedVehicle, selectedGeofence]);

  const defaultCenter: [number, number] = [-19.0, 31.0];

  const depotIcon = useCallback((type: string) => createDepotIcon(type), []);
  const customLocationIcon = useMemo(() => createCustomLocationIcon(), []);

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Live Fleet Tracking</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time vehicle positions and route monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            {authenticated ? (
              <>
                <Button
                  variant="outline"
                  onClick={fetchAssets}
                  disabled={loading}
                  size="sm"
                >
                  <svg className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettingsDialog(true)}
                  className="h-8 w-8"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowAuthDialog(true)}>
                Connect to Telematics
              </Button>
            )}
          </div>
        </div>

        {/* ETA Calculator Card - Professional Design */}
        {authenticated && !maximizeMap && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Route & ETA Calculator</CardTitle>
                  <CardDescription className="text-xs">
                    Calculate estimated arrival time for vehicles to destinations
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRouteCalculator(!showRouteCalculator)}
                  className="h-8 px-3 text-xs"
                >
                  {showRouteCalculator ? "Hide" : "Show"}
                </Button>
              </div>
            </CardHeader>
            {showRouteCalculator && (
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle-select" className="text-xs font-medium text-muted-foreground">
                      Select Vehicle
                    </Label>
                    <select
                      id="vehicle-select"
                      title="Select vehicle for ETA"
                      className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedVehicleId || ""}
                      onChange={(e) =>
                        setSelectedVehicleId(
                          e.target.value ? parseInt(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">Choose a vehicle...</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name || asset.code || `Vehicle ${asset.id}`}
                          {asset.speedKmH > 0
                            ? ` (${Math.round(asset.speedKmH)} km/h)`
                            : " (Stationary)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="geofence-select" className="text-xs font-medium text-muted-foreground">
                      Destination
                    </Label>
                    <select
                      id="geofence-select"
                      title="Select destination geofence"
                      className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedGeofenceId || ""}
                      onChange={(e) =>
                        setSelectedGeofenceId(
                          e.target.value ? parseInt(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">Choose a destination...</option>
                      {geofences.map((geofence) => (
                        <option key={geofence.id} value={geofence.id}>
                          {geofence.name}
                          {geofence.description
                            ? ` - ${geofence.description}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {etaResult && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Estimated Arrival
                        </Label>
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-xl font-semibold text-primary">
                            {etaResult.etaFormatted}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {etaResult.durationFormatted}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Distance
                        </Label>
                        <div className="p-3 rounded-lg bg-muted/30 border">
                          <p className="text-xl font-semibold">
                            {etaResult.distanceFormatted}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {etaResult.isMoving
                              ? `Moving at ${Math.round(etaResult.speed)} km/h`
                              : "Vehicle stationary"}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {(!selectedVehicleId || !selectedGeofenceId) && (
                    <div className="md:col-span-2 flex items-center justify-center p-4 rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground">
                        Select a vehicle and destination to calculate ETA
                      </p>
                    </div>
                  )}
                </div>

                {(selectedVehicleId || selectedGeofenceId) && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVehicleId(null);
                        setSelectedGeofenceId(null);
                        setEtaResult(null);
                      }}
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Main Content */}
        {authenticated && (
          <div className="flex gap-5">
            {/* Map Section */}
            <div className="flex-1">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b">
                  <CardTitle className="text-base font-medium">Fleet Map</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={maximizeMap ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaximizeMap((v) => !v)}
                      className="h-8 px-3 text-xs"
                    >
                      {maximizeMap ? "Exit Full Screen" : "Full Screen"}
                    </Button>
                    <Button
                      variant={showDepots ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowDepots(!showDepots)}
                      className="h-8 px-3 text-xs"
                    >
                      Depots ({DEPOTS.length})
                    </Button>
                    {authenticated && geofences.length > 0 && (
                      <Button
                        variant={showGeofences ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowGeofences(!showGeofences)}
                        className="h-8 px-3 text-xs"
                      >
                        Geofences ({geofences.length})
                      </Button>
                    )}
                    {lastRefresh && (
                      <span className="text-xs text-muted-foreground">
                        {lastRefresh.toLocaleTimeString()}
                        {autoRefresh && ` • ${_refreshInterval}s`}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {!authenticated ? (
                    <div className="h-[600px] flex flex-col items-center justify-center bg-muted/30">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <p className="text-base font-medium mb-1">Connect to Telematics Guru</p>
                      <p className="text-sm text-muted-foreground mb-4">Sign in to view your fleet's live positions</p>
                      <Button onClick={() => setShowAuthDialog(true)} size="sm">
                        Connect Now
                      </Button>
                    </div>
                  ) : loading && assets.length === 0 ? (
                    <div className="h-[600px] flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="h-[600px] rounded-b-lg overflow-hidden">
                      <MapContainer
                        center={defaultCenter}
                        zoom={7}
                        style={{ height: "100%", width: "100%" }}
                        scrollWheelZoom
                      >
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                          attribution='&copy; <a href="https://carto.com/">Carto</a>'
                        />

                        {/* Geofences */}
                        {showGeofences &&
                          geofences.map((geofence) => {
                            const lat = geofence.latitude ?? geofence.centerLatitude ?? geofence.lat;
                            const lng = geofence.longitude ?? geofence.centerLongitude ?? geofence.lng;
                            const radius = geofence.radius || 500;
                            if (!lat || !lng) return null;
                            return (
                              <Circle
                                key={geofence.id}
                                center={[lat, lng]}
                                radius={radius}
                                pathOptions={{ color: "#8b5cf6", fillColor: "#8b5cf6", fillOpacity: 0.1, weight: 1.5 }}
                              >
                                <Tooltip permanent={false} direction="top">
                                  <div className="text-sm font-medium">{geofence.name}</div>
                                  {geofence.description && <div className="text-xs text-muted-foreground">{geofence.description}</div>}
                                </Tooltip>
                              </Circle>
                            );
                          })}

                        {/* Depots */}
                        {showDepots &&
                          DEPOTS.map((depot) => {
                            const color = depot.type === 'depot' ? '#059669' : depot.type === 'warehouse' ? '#0284c7' : '#9333ea';
                            return (
                              <React.Fragment key={depot.id}>
                                {depot.polygon && depot.polygon.length >= 3 ? (
                                  <LeafletPolygon
                                    positions={depot.polygon.map(([lat, lng]) => [lat, lng] as [number, number])}
                                    pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5 }}
                                  />
                                ) : (
                                  <Circle
                                    center={[depot.latitude, depot.longitude]}
                                    radius={depot.radius}
                                    pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1.5, dashArray: '5, 5' }}
                                  />
                                )}
                                <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon(depot.type)}>
                                  <Popup>
                                    <div className="p-1 min-w-[160px]">
                                      <div className="font-semibold text-sm">{depot.name}</div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {depot.type.charAt(0).toUpperCase() + depot.type.slice(1)} • {depot.country}
                                      </div>
                                    </div>
                                  </Popup>
                                </Marker>
                              </React.Fragment>
                            );
                          })}

                        {/* Custom Locations */}
                        {customLocations.map((loc) => (
                          <React.Fragment key={loc.id}>
                            <Circle
                              center={[Number(loc.latitude), Number(loc.longitude)]}
                              radius={500}
                              pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.1, weight: 1.5, dashArray: '5, 5' }}
                            />
                            <Marker position={[Number(loc.latitude), Number(loc.longitude)]} icon={customLocationIcon}>
                              <Popup><div className="font-medium text-sm">{loc.name}</div></Popup>
                            </Marker>
                          </React.Fragment>
                        ))}

                        {/* Route Polyline */}
                        {routeCoords.length > 0 && (
                          <Polyline
                            positions={routeCoords}
                            pathOptions={{ color: "#4f46e5", weight: 3, opacity: 0.7 }}
                          >
                            <Tooltip permanent direction="center">
                              <div className="text-xs bg-background/90 px-2 py-1 rounded shadow-sm">
                                {etaResult ? (
                                  <>
                                    <div>{etaResult.distanceFormatted}</div>
                                    <div className="text-primary">ETA: {etaResult.etaFormatted}</div>
                                  </>
                                ) : "Calculating route..."}
                              </div>
                            </Tooltip>
                          </Polyline>
                        )}

                        {/* Vehicle Markers */}
                        {assets.map((asset) => {
                          const load = getLoadForAsset(asset);
                          if (asset.lastLatitude === null || asset.lastLongitude === null) return null;
                          return (
                            <Marker
                              key={asset.id}
                              position={[asset.lastLatitude, asset.lastLongitude]}
                              icon={createVehicleIcon(asset, !!load)}
                            >
                              <Popup>
                                <div className="min-w-[240px]">
                                  <div className="font-semibold text-base mb-2">
                                    {asset.name || asset.code || `Vehicle ${asset.id}`}
                                  </div>
                                  {load && (
                                    <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-md border border-purple-200 dark:border-purple-800">
                                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400 font-medium text-xs mb-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        Active Delivery
                                      </div>
                                      <div className="text-xs space-y-0.5">
                                        <div><span className="font-medium">Load:</span> {load.load_id}</div>
                                        <div><span className="font-medium">To:</span> {load.destination || "N/A"}</div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Speed:</span>
                                      <span className="font-medium">{Math.round(asset.speedKmH)} km/h</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Last seen:</span>
                                      <span className="text-xs">{formatLastConnected(asset.lastConnectedUtc)}</span>
                                    </div>
                                    <button
                                      onClick={() => openTripHistory(asset)}
                                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-xs font-medium transition-colors"
                                    >
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Trip History
                                    </button>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                        <FitBounds assets={assets} />
                      </MapContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fleet List Sidebar */}
            {authenticated && assets.length > 0 && (
              <div className="w-80 shrink-0">
                <Card className="shadow-sm">
                  <CardHeader className="py-3 px-4 border-b">
                    <CardTitle className="text-sm font-medium">Fleet Vehicles</CardTitle>
                    <CardDescription className="text-xs">{assets.length} active vehicles</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(600px-57px)]">
                      <div className="divide-y">
                        {assets.map((asset) => {
                          const load = getLoadForAsset(asset);
                          const isStationary = asset.speedKmH < 5 && !asset.inTrip;
                          return (
                            <div
                              key={asset.id}
                              className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors ${load ? "bg-purple-50/50 dark:bg-purple-900/5" : ""}`}
                              onClick={() => openTripHistory(asset)}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: isStationary ? "#dc2626" : getStatusColor(asset) }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {asset.name || asset.code || `Vehicle ${asset.id}`}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round(asset.speedKmH)} km/h
                                  </span>
                                  {load && (
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                      LOAD
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Auth Dialog */}
        <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Connect to Telematics Guru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                <Label htmlFor="rememberMe" className="text-sm cursor-pointer">Remember me</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAuthDialog(false)}>Cancel</Button>
              <Button onClick={handleAuth} disabled={authLoading}>
                {authLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
                {authLoading ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Tracking Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh" className="text-sm">Auto Refresh</Label>
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
              <Separator />
              <Button variant="destructive" className="w-full" onClick={handleLogout}>
                Disconnect
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Trip History Dialog */}
        <TripHistoryDialog
          open={!!tripHistoryAsset}
          onOpenChange={(open) => { if (!open) { setTripHistoryAsset(null); setTripHistoryLoads([]); } }}
          asset={tripHistoryAsset}
          activeLoad={tripHistoryAsset ? getLoadForAsset(tripHistoryAsset) : null}
          vehicleLoads={tripHistoryLoads as never[]}
          organisationId={organisationId ? parseInt(organisationId) : null}
        />
      </div>
    </>
  );
}