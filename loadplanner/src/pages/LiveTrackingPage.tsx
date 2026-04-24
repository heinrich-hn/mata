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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
// ---------------------------------------------------------------------------
// Vehicle status taxonomy (matches Samsara/Motive-style markers)
// ---------------------------------------------------------------------------

type VehicleStatus = "moving" | "idle" | "offline";

// A vehicle is only "offline" if we have no usable position at all,
// or the most recent position fix is older than this threshold.
// Telematics Guru's `lastConnectedUtc` is unreliable for parked vehicles —
// it tracks the cellular check-in which can lag many hours behind GPS.
const OFFLINE_THRESHOLD_HOURS = 24;

function getVehicleStatus(asset: TelematicsAsset): VehicleStatus {
  // No coordinates at all → device has never reported → offline
  if (asset.lastLatitude == null || asset.lastLongitude == null) {
    return "offline";
  }

  // If we have any timestamp, only flag as offline when extremely stale.
  const ts = asset.lastPositionUtc || asset.lastConnectedUtc;
  if (ts) {
    const last = new Date(ts).getTime();
    if (!isNaN(last)) {
      const hoursAgo = (Date.now() - last) / 3_600_000;
      if (hoursAgo > OFFLINE_THRESHOLD_HOURS) return "offline";
    }
  }

  return asset.speedKmH >= 5 ? "moving" : "idle";
}

// Status palette (used by markers, list, dropdown) — matches the reference
const STATUS_COLOR: Record<VehicleStatus, string> = {
  moving: "#10b981", // emerald-500
  idle: "#f59e0b", // amber-500
  offline: "#64748b", // slate-500
};

function createVehicleIcon(
  asset: TelematicsAsset,
  hasActiveLoad = false,
): L.DivIcon {
  const status = getVehicleStatus(asset);
  const rotation = asset.heading || 0;

  let inner: string;
  let size: [number, number] = [28, 28];
  let anchor: [number, number] = [14, 14];

  if (status === "moving") {
    // Green triangle pointing in direction of travel
    inner = `
      <div style="
        width:30px;height:30px;
        display:flex;align-items:center;justify-content:center;
        transform:rotate(${rotation}deg);
        transform-origin:center;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,0.18));
      ">
        <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L21 21 L12 17 L3 21 Z" fill="${STATUS_COLOR.moving}" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
      </div>`;
    size = [30, 30];
    anchor = [15, 15];
  } else if (status === "idle") {
    // Orange parallel bars
    inner = `
      <div style="
        width:24px;height:24px;
        display:flex;align-items:center;justify-content:center;gap:3px;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,0.18));
      ">
        <span style="display:block;width:5px;height:18px;background:${STATUS_COLOR.idle};border-radius:1.5px;border:1px solid rgba(255,255,255,0.85);"></span>
        <span style="display:block;width:5px;height:18px;background:${STATUS_COLOR.idle};border-radius:1.5px;border:1px solid rgba(255,255,255,0.85);"></span>
      </div>`;
  } else {
    // Offline: solid gray square
    inner = `
      <div style="
        width:18px;height:18px;
        background:${STATUS_COLOR.offline};
        border:2px solid white;border-radius:2px;
        box-shadow:0 1px 3px rgba(0,0,0,0.18);
      "></div>`;
    size = [22, 22];
    anchor = [11, 11];
  }

  const html = `
    <div class="fleet-vehicle-marker" style="position:relative;display:flex;align-items:center;justify-content:center;">
      ${inner}
      ${hasActiveLoad ? `
        <div style="
          position:absolute;top:-2px;right:-2px;
          width:9px;height:9px;border-radius:50%;
          background:#4f46e5;border:1.5px solid white;
          box-shadow:0 0 0 1px rgba(79,70,229,0.3);
          z-index:5;
        "></div>` : ''}
    </div>`;

  return L.divIcon({
    html,
    className: "fleet-vehicle-marker-wrapper",
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
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

type SidebarFilter = "all" | "moving" | "idle" | "offline" | "loaded";

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
    let moving = 0, idle = 0, offline = 0, loaded = 0;
    for (const asset of assets) {
      const s = getVehicleStatus(asset);
      if (s === "moving") moving++;
      else if (s === "idle") idle++;
      else offline++;
      if (getLoadForAsset(asset)) loaded++;
    }
    return { moving, idle, offline, loaded, total: assets.length };
  }, [assets, getLoadForAsset]);

  // Filtered + sorted sidebar assets
  const filteredSidebarAssets = useMemo(() => {
    const query = vehicleSearch.toLowerCase().trim();
    const statusOrder: Record<VehicleStatus, number> = { moving: 0, idle: 1, offline: 2 };
    return assets
      .filter((asset) => {
        const name = (asset.name || asset.code || `Vehicle ${asset.id}`).toLowerCase();
        if (query && !name.includes(query)) return false;
        const s = getVehicleStatus(asset);
        if (sidebarFilter === "moving") return s === "moving";
        if (sidebarFilter === "idle") return s === "idle";
        if (sidebarFilter === "offline") return s === "offline";
        if (sidebarFilter === "loaded") return !!getLoadForAsset(asset);
        return true;
      })
      .sort((a, b) => {
        // Moving first, then idle, then offline; tie-break by name
        const sa = statusOrder[getVehicleStatus(a)];
        const sb = statusOrder[getVehicleStatus(b)];
        if (sa !== sb) return sa - sb;
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
          id, load_id, origin, destination, status, loading_date, offloading_date, time_window,
          actual_loading_arrival, actual_loading_arrival_source, actual_loading_arrival_verified,
          actual_loading_departure, actual_loading_departure_source, actual_loading_departure_verified,
          actual_offloading_arrival, actual_offloading_arrival_source, actual_offloading_arrival_verified,
          actual_offloading_departure, actual_offloading_departure_source, actual_offloading_departure_verified,
          driver:drivers!loads_driver_id_fkey(id, name, contact),
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

        {/* Main Content — full-bleed map with overlay sidebar */}
        {authenticated && (
          <div
            className={
              maximizeMap
                ? "fixed inset-0 z-[60] bg-white"
                : "relative h-[calc(100vh-180px)] min-h-[640px] rounded-xl overflow-hidden border shadow-sm bg-slate-100"
            }
          >
            {/* Floating top-right map controls */}
            <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white rounded-lg border shadow-sm px-1 py-1">
                <Button
                  variant={showDepots ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setShowDepots(!showDepots)}
                  className="h-7 px-2.5 text-xs"
                >
                  Depots ({DEPOTS.length})
                </Button>
                {geofences.length > 0 && (
                  <Button
                    variant={showGeofences ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowGeofences(!showGeofences)}
                    className="h-7 px-2.5 text-xs"
                  >
                    Geofences ({geofences.length})
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMaximizeMap((v) => !v)}
                className="h-9 w-9 bg-white shadow-sm"
                title={maximizeMap ? "Exit Full Screen" : "Full Screen"}
              >
                {maximizeMap ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5m0 0L20.5 20.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                )}
              </Button>
            </div>

            {/* Last refresh stamp — bottom-right */}
            {lastRefresh && (
              <div className="absolute bottom-4 right-4 z-[1000] text-[11px] text-slate-600 bg-white/90 backdrop-blur rounded-md border shadow-sm px-2 py-1">
                Updated {lastRefresh.toLocaleTimeString()}{autoRefresh && ` · auto ${_refreshInterval}s`}
              </div>
            )}

            {loading && assets.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="absolute inset-0">
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
                        <Popup className="fleet-card-popup" closeButton={false}>
                          <div className="fleet-popup w-[260px]">
                            {/* Header: truck icon + name + MPH/Idle/Offline badge */}
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8h4l3 4v4a1 1 0 01-1 1h-1" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-900 truncate leading-tight">
                                    {asset.name || asset.code || `Vehicle ${asset.id}`}
                                  </div>
                                </div>
                              </div>
                              {(() => {
                                const status = getVehicleStatus(asset);
                                if (status === "moving") {
                                  return (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap tabular-nums">
                                      {Math.round(asset.speedKmH)} km/h
                                    </span>
                                  );
                                }
                                if (status === "idle") {
                                  return (
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                      Idle
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                    Offline
                                  </span>
                                );
                              })()}
                            </div>

                            {/* Driver row */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 mb-1.5 underline decoration-slate-300 underline-offset-2">
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="truncate">{load?.driver?.name || "Unassigned driver"}</span>
                            </div>

                            {/* Location row */}
                            <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              <span className="leading-tight">
                                {load?.destination
                                  ? <>En route to <span className="font-medium text-slate-800">{load.destination}</span></>
                                  : asset.lastLatitude != null && asset.lastLongitude != null
                                    ? `${asset.lastLatitude.toFixed(4)}, ${asset.lastLongitude.toFixed(4)}`
                                    : "Location unavailable"}
                              </span>
                            </div>

                            {/* Last update row */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{formatLastConnected(asset.lastConnectedUtc)}</span>
                            </div>

                            {/* Action link */}
                            <div className="pt-2 border-t border-slate-100">
                              <button
                                onClick={() => openTripHistory(asset)}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md py-1.5 transition-colors"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                                View Trip History
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

            {/* Floating Sidebar Overlay (Samsara/Motive style) */}
            {assets.length > 0 && (
              <aside className="absolute top-4 left-4 z-[1000] w-[340px] h-[calc(100%-32px)] max-h-[calc(100%-32px)] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border overflow-hidden">
                {/* Header: title + search + status filter */}
                <div className="px-4 pt-4 pb-3 border-b space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold tracking-tight">Fleet Vehicles</div>
                      <div className="text-[11px] text-muted-foreground">{statusCounts.total} vehicles tracked</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-emerald-200 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {statusCounts.moving}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-amber-200 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {statusCounts.idle}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold gap-1 border-slate-200 text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        {statusCounts.offline}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <Input
                        placeholder="Search"
                        value={vehicleSearch}
                        onChange={(e) => setVehicleSearch(e.target.value)}
                        className="h-8 pl-8 text-xs rounded-full bg-slate-50 border-slate-200"
                      />
                      {vehicleSearch && (
                        <button
                          onClick={() => setVehicleSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Clear search"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <Select value={sidebarFilter} onValueChange={(v) => setSidebarFilter(v as SidebarFilter)}>
                      <SelectTrigger className="w-[110px] h-8 text-xs rounded-md">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="all" className="text-xs">All</SelectItem>
                        <SelectItem value="moving" className="text-xs">
                          <span className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2 L21 21 L12 17 L3 21 Z" fill="#10b981" stroke="white" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                            Moving
                          </span>
                        </SelectItem>
                        <SelectItem value="idle" className="text-xs">
                          <span className="flex items-center gap-2">
                            <span className="inline-flex gap-[2px]"><span className="w-[3px] h-3 bg-amber-500 rounded-sm" /><span className="w-[3px] h-3 bg-amber-500 rounded-sm" /></span>
                            Idle
                          </span>
                        </SelectItem>
                        <SelectItem value="offline" className="text-xs">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-slate-500 rounded-sm" />
                            Offline
                          </span>
                        </SelectItem>
                        {statusCounts.loaded > 0 && (
                          <SelectItem value="loaded" className="text-xs">
                            <span className="flex items-center gap-2">
                              <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                              On Trip
                            </span>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Vehicle list */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  {filteredSidebarAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-xs">No vehicles match</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredSidebarAssets.map((asset) => {
                        const status = getVehicleStatus(asset);
                        const load = getLoadForAsset(asset);
                        const driverName = load?.driver?.name;
                        const vehicleName = asset.name || asset.code || `Vehicle ${asset.id}`;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => handleVehicleClick(asset)}
                            className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                          >
                            {/* Status icon — mirrors map markers */}
                            <div className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                              {status === "moving" && (
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                  <path d="M12 2 L21 21 L12 17 L3 21 Z" fill="#10b981" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
                                </svg>
                              )}
                              {status === "idle" && (
                                <span className="inline-flex items-center gap-[3px]">
                                  <span className="w-[4px] h-[14px] bg-amber-500 rounded-sm" />
                                  <span className="w-[4px] h-[14px] bg-amber-500 rounded-sm" />
                                </span>
                              )}
                              {status === "offline" && (
                                <span className="w-[12px] h-[12px] bg-slate-500 rounded-sm" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                                  {vehicleName}
                                </div>
                                {status === "moving" && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap tabular-nums">
                                    {Math.round(asset.speedKmH)} km/h
                                  </span>
                                )}
                                {load && (
                                  <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold bg-indigo-100 text-indigo-700 border-0">
                                    LOAD
                                  </Badge>
                                )}
                              </div>

                              {/* Origin / Destination if on a trip */}
                              {load ? (
                                <div className="space-y-0.5 mt-1">
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 ring-2 ring-slate-100 flex-shrink-0" />
                                    <span className="truncate">{load.origin || "Origin"}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                                    <svg className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="truncate">{load.destination || "Destination"}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {status === "offline"
                                    ? `Offline · last seen ${formatLastConnected(asset.lastConnectedUtc)}`
                                    : `${Math.round(asset.speedKmH)} km/h · ${formatLastConnected(asset.lastConnectedUtc)}`}
                                </div>
                              )}

                              {/* Driver row */}
                              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
                                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="truncate">{driverName || "Unassigned"}</span>
                              </div>
                            </div>

                            {/* Hover actions */}
                            <button
                              onClick={(e) => { e.stopPropagation(); openTripHistory(asset); }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 transition-all flex-shrink-0"
                              title="View trip history"
                            >
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>
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