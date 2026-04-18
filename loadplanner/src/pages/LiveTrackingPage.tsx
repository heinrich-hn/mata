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
  isAuthenticated,
  type TelematicsAsset,
  type TelematicsGeofence,
} from "@/lib/telematicsGuru";
import { formatDistance } from "@/lib/waypoints";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Professional vehicle marker — refined corporate design
function createVehicleIcon(
  asset: TelematicsAsset,
  hasActiveLoad = false,
): L.DivIcon {
  const isMoving = asset.speedKmH >= 5;
  const rotation = asset.heading || 0;
  const fleetNumber = asset.name || asset.code || `${asset.id}`;
  const displayNumber =
    fleetNumber.length > 8 ? fleetNumber.substring(0, 7) + "…" : fleetNumber;

  // Palette: moving = teal-600, stopped = slate-500, load indicator = indigo
  const bgColor = isMoving ? "#0d9488" : "#64748b";
  const ringColor = isMoving ? "rgba(13,148,136,0.25)" : "rgba(100,116,139,0.2)";
  const labelBg = isMoving ? "#0f766e" : "#475569";

  const markerHtml = `
    <div class="fleet-vehicle-marker" style="position:relative;display:flex;flex-direction:column;align-items:center;">
      ${isMoving ? `<div style="
        position:absolute;top:50%;left:50%;width:32px;height:32px;
        transform:translate(-50%,-50%);
        border-radius:50%;background:${ringColor};
        animation:fleet-pulse 2s ease-out infinite;
      "></div>` : ''}
      <div style="
        position:relative;z-index:2;
        width:24px;height:24px;
        background:${bgColor};
        border-radius:${isMoving ? '6px' : '50%'};
        border:2px solid rgba(255,255,255,0.95);
        box-shadow:0 1px 3px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);
        display:flex;align-items:center;justify-content:center;
        ${isMoving ? `transform:rotate(${rotation}deg);` : ''}
        transition:transform 0.3s ease;
      ">
        ${isMoving ? `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 4L12 20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M12 4L7 10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M12 4L17 10" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        ` : `
        <div style="width:6px;height:6px;background:white;border-radius:50%;opacity:0.9;"></div>
        `}
      </div>
      <div style="
        position:absolute;top:${isMoving ? '28' : '26'}px;left:50%;
        transform:translateX(-50%);z-index:3;
        background:${labelBg};color:white;
        font-size:10px;font-weight:600;letter-spacing:0.02em;
        padding:2px 6px;border-radius:4px;
        white-space:nowrap;
        font-family:'Inter',system-ui,-apple-system,sans-serif;
        line-height:1.3;
        box-shadow:0 1px 2px rgba(0,0,0,0.1);
      ">${displayNumber}</div>
      ${hasActiveLoad ? `
      <div style="
        position:absolute;top:-3px;right:-3px;z-index:4;
        background:linear-gradient(135deg,#6366f1,#4f46e5);width:10px;height:10px;
        border-radius:50%;border:2px solid white;
        box-shadow:0 0 0 1px rgba(99,102,241,0.3);
      "></div>` : ''}
    </div>`;

  return L.divIcon({
    html: markerHtml,
    className: "fleet-vehicle-marker-wrapper",
    iconSize: [32, 44],
    iconAnchor: [16, 22],
    popupAnchor: [0, -22],
  });
}

// Depot marker — refined corporate icon set
function createDepotIcon(type: string): L.DivIcon {
  const config: Record<string, { bg: string; icon: string }> = {
    depot: {
      bg: "#047857",
      icon: `<path d="M3 21h18M4 18h16M6 18V10l6-5 6 5v8" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="rgba(255,255,255,0.15)"/><path d="M10 18v-4h4v4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    },
    warehouse: {
      bg: "#0369a1",
      icon: `<rect x="3" y="8" width="18" height="13" rx="1" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/><path d="M3 8L12 3L21 8" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14h8M8 17h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
    },
    market: {
      bg: "#b91c1c",
      icon: `<path d="M3 3h18l-2 9H5L3 3z" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/><circle cx="9" cy="18" r="2" stroke="white" stroke-width="1.5"/><circle cx="17" cy="18" r="2" stroke="white" stroke-width="1.5"/>`,
    },
    default: {
      bg: "#7c3aed",
      icon: `<circle cx="12" cy="10" r="7" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.15)"/><path d="M12 17L12 21" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M9 21h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
    },
  };
  const { bg, icon } = config[type] || config.default;

  return L.divIcon({
    html: `
      <div class="fleet-depot-marker" style="
        width:30px;height:30px;
        background:${bg};
        border-radius:8px;
        border:2px solid rgba(255,255,255,0.95);
        box-shadow:0 1px 3px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.08);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">${icon}</svg>
      </div>
    `,
    className: "fleet-depot-marker-wrapper",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Custom location marker — map-pin style
const createCustomLocationIcon = (): L.DivIcon => {
  return L.divIcon({
    html: `
      <div class="fleet-custom-marker" style="
        position:relative;display:flex;flex-direction:column;align-items:center;
      ">
        <div style="
          width:26px;height:26px;
          background:linear-gradient(135deg,#f97316,#ea580c);
          border-radius:50% 50% 50% 4px;
          transform:rotate(-45deg);
          border:2px solid rgba(255,255,255,0.95);
          box-shadow:0 1px 3px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);
          display:flex;align-items:center;justify-content:center;
        ">
          <div style="width:8px;height:8px;background:white;border-radius:50%;transform:rotate(45deg);"></div>
        </div>
      </div>
    `,
    className: "fleet-custom-marker-wrapper",
    iconSize: [26, 34],
    iconAnchor: [13, 30],
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

function FlyToVehicle({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target && map) {
      map.flyTo([target.lat, target.lng], 14, { duration: 1 });
    }
  }, [target, map]);
  return null;
}

type SidebarFilter = "all" | "moving" | "idle" | "loaded";

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

  // Sidebar search & filter state
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("all");
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());

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

  // Status counts for quick summary
  const statusCounts = useMemo(() => {
    let moving = 0, idle = 0, loaded = 0;
    for (const asset of assets) {
      if (asset.speedKmH >= 5) moving++; else idle++;
      if (getLoadForAsset(asset)) loaded++;
    }
    return { moving, idle, loaded, total: assets.length };
  }, [assets, getLoadForAsset]);

  // Filtered + sorted sidebar assets
  const filteredSidebarAssets = useMemo(() => {
    const query = vehicleSearch.toLowerCase().trim();
    return assets
      .filter((asset) => {
        const name = (asset.name || asset.code || `Vehicle ${asset.id}`).toLowerCase();
        if (query && !name.includes(query)) return false;
        if (sidebarFilter === "moving") return asset.speedKmH >= 5;
        if (sidebarFilter === "idle") return asset.speedKmH < 5;
        if (sidebarFilter === "loaded") return !!getLoadForAsset(asset);
        return true;
      })
      .sort((a, b) => {
        // Moving first, then by name
        const aMoving = a.speedKmH >= 5 ? 0 : 1;
        const bMoving = b.speedKmH >= 5 ? 0 : 1;
        if (aMoving !== bMoving) return aMoving - bMoving;
        return (a.name || a.code || "").localeCompare(b.name || b.code || "");
      });
  }, [assets, vehicleSearch, sidebarFilter, getLoadForAsset]);

  // Fly to vehicle on sidebar click, then open popup
  const handleVehicleClick = useCallback((asset: TelematicsAsset) => {
    if (asset.lastLatitude != null && asset.lastLongitude != null) {
      setFlyTarget({ lat: asset.lastLatitude, lng: asset.lastLongitude });
      // Open popup after fly animation
      setTimeout(() => {
        const marker = markerRefs.current.get(asset.id);
        if (marker) marker.openPopup();
      }, 1100);
    }
  }, []);

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
                          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
                                pathOptions={{ color: "#7c3aed", fillColor: "#8b5cf6", fillOpacity: 0.06, weight: 1, dashArray: "4,4" }}
                              >
                                <Tooltip permanent={false} direction="top">
                                  <div className="text-xs font-semibold tracking-tight">{geofence.name}</div>
                                  {geofence.description && <div className="text-[10px] text-muted-foreground mt-0.5">{geofence.description}</div>}
                                </Tooltip>
                              </Circle>
                            );
                          })}

                        {/* Depots */}
                        {showDepots &&
                          DEPOTS.map((depot) => {
                            const color = depot.type === 'depot' ? '#047857' : depot.type === 'warehouse' ? '#0369a1' : '#7c3aed';
                            return (
                              <React.Fragment key={depot.id}>
                                {depot.polygon && depot.polygon.length >= 3 ? (
                                  <LeafletPolygon
                                    positions={depot.polygon.map(([lat, lng]) => [lat, lng] as [number, number])}
                                    pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
                                  />
                                ) : (
                                  <Circle
                                    center={[depot.latitude, depot.longitude]}
                                    radius={depot.radius}
                                    pathOptions={{ color, fillColor: color, fillOpacity: 0.06, weight: 1, dashArray: '4,4' }}
                                  />
                                )}
                                <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon(depot.type)}>
                                  <Popup>
                                    <div className="fleet-popup p-1.5 min-w-[180px]">
                                      <div className="font-semibold text-sm tracking-tight">{depot.name}</div>
                                      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">
                                        {depot.type.charAt(0).toUpperCase() + depot.type.slice(1)} &middot; {depot.country}
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

                        {/* Route Polyline — refined dashed route line */}
                        {routeCoords.length > 0 && (
                          <>
                            <Polyline
                              positions={routeCoords}
                              pathOptions={{ color: "#818cf8", weight: 5, opacity: 0.2, lineCap: "round", lineJoin: "round" }}
                            />
                            <Polyline
                              positions={routeCoords}
                              pathOptions={{ color: "#4f46e5", weight: 3, opacity: 0.8, dashArray: "8,6", lineCap: "round", lineJoin: "round" }}
                            >
                              <Tooltip permanent direction="center">
                                <div className="fleet-route-tooltip">
                                  {etaResult ? (
                                    <>
                                      <span className="font-semibold">{etaResult.distanceFormatted}</span>
                                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold"> &middot; ETA {etaResult.etaFormatted}</span>
                                    </>
                                  ) : "Calculating..."}
                                </div>
                              </Tooltip>
                            </Polyline>
                          </>
                        )}

                        <FlyToVehicle target={flyTarget} />

                        {/* Vehicle Markers */}
                        {assets.map((asset) => {
                          const load = getLoadForAsset(asset);
                          if (asset.lastLatitude === null || asset.lastLongitude === null) return null;
                          return (
                            <Marker
                              key={asset.id}
                              position={[asset.lastLatitude, asset.lastLongitude]}
                              icon={createVehicleIcon(asset, !!load)}
                              ref={(ref) => {
                                if (ref) markerRefs.current.set(asset.id, ref);
                              }}
                            >
                              <Popup>
                                <div className="fleet-popup min-w-[260px]">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold tracking-tight">
                                      {asset.name || asset.code || `Vehicle ${asset.id}`}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${asset.speedKmH >= 5
                                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                      }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${asset.speedKmH >= 5 ? 'bg-teal-500' : 'bg-slate-400'}`}></span>
                                      {asset.speedKmH >= 5 ? 'Moving' : 'Idle'}
                                    </span>
                                  </div>
                                  {load && (
                                    <div className="mb-3 p-2.5 bg-indigo-50/80 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                                      <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-semibold text-[10px] uppercase tracking-wider mb-1.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        Active Delivery
                                      </div>
                                      <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Load</span><span className="font-medium">{load.load_id}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span className="font-medium">{load.destination || "N/A"}</span></div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">Speed</span>
                                      <span className="font-semibold tabular-nums">{Math.round(asset.speedKmH)} km/h</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">Last update</span>
                                      <span className="font-medium text-muted-foreground">{formatLastConnected(asset.lastConnectedUtc)}</span>
                                    </div>
                                    <div className="pt-1.5 border-t">
                                      <button
                                        onClick={() => openTripHistory(asset)}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-medium transition-colors"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        View Trip History
                                      </button>
                                    </div>
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
                  <CardHeader className="py-3 px-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">Fleet Vehicles</CardTitle>
                        <CardDescription className="text-xs">{assets.length} active vehicles</CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          {statusCounts.moving}
                        </Badge>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {statusCounts.idle}
                        </Badge>
                        {statusCounts.loaded > 0 && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            {statusCounts.loaded}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <Input
                        placeholder="Search vehicles..."
                        value={vehicleSearch}
                        onChange={(e) => setVehicleSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                      {vehicleSearch && (
                        <button
                          onClick={() => setVehicleSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Filter tabs */}
                    <div className="flex gap-1">
                      {(["all", "moving", "idle", "loaded"] as SidebarFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setSidebarFilter(f)}
                          className={`flex-1 text-[10px] font-medium py-1 rounded-md transition-colors capitalize ${sidebarFilter === f
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted"
                            }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(600px-160px)]">
                      {filteredSidebarAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-xs">No vehicles match</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {filteredSidebarAssets.map((asset) => {
                            const load = getLoadForAsset(asset);
                            const isMoving = asset.speedKmH >= 5;
                            return (
                              <div
                                key={asset.id}
                                className={`group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-all duration-150 ${load ? "bg-indigo-50/40 dark:bg-indigo-950/10" : ""}`}
                                onClick={() => handleVehicleClick(asset)}
                              >
                                <div className="relative flex-shrink-0">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: isMoving ? "#0d9488" : "#94a3b8" }}
                                  />
                                  {isMoving && (
                                    <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: "#0d9488", opacity: 0.4 }} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate tracking-tight">
                                    {asset.name || asset.code || `Vehicle ${asset.id}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                      {Math.round(asset.speedKmH)} km/h
                                    </span>
                                    {load && (
                                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0">
                                        LOAD
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openTripHistory(asset); }}
                                    className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                    title="View trip history"
                                  >
                                    <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                  <svg className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                  </svg>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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