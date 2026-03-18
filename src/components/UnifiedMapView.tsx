/**
 * Unified Map View Component
 * Combines all map functionality into a single interface:
 * - Real-time vehicle tracking (Wialon)
 * - Historical track visualization
 * - Geofence display
 * - Route planning
 * - Vehicle selection from unified list
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import type { ReportResult } from '@/hooks/useWialonReports';
import { supabase } from '@/integrations/supabase/client';
import { useWialonContext, type VehicleLocation } from '@/integrations/wialon';
import L from 'leaflet';
import {
ArrowDown,
ArrowUp,
ChevronLeft,
ChevronRight,
Eye,
EyeOff,
FileBarChart,
History,
Layers,
List,
Loader2,
MapPin,
Maximize2,
Play,
RefreshCw,
Route as RouteIcon,
Save,
Search,
Shield,
Square,
Truck,
X,
Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
Circle,
MapContainer,
Marker,
Polygon,
Polyline,
Popup,
TileLayer,
useMap
} from 'react-leaflet';
import { SaveRouteDialog } from './map/SaveRouteDialog';
import { MapReportPanel } from './map/MapReportPanel';
import { ReportResultsPanel } from './map/ReportResultsPanel';
import WialonSensorWidget from './sensors/WialonSensorWidget';
import { DatePicker } from './ui/date-picker';
import LiveVehicleDataPanel from './map/LiveVehicleDataPanel';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
}

interface VehicleTrack {
  unitId: string;
  unitName: string;
  color: string;
  points: TrackPoint[];
  isVisible: boolean;
  isDemo: boolean;
  mileage: number;
}

interface VehicleGeofenceState {
  inside: Set<string>;
  enterTimestamps: Map<string, number>;
}

interface VehicleAliasInfo {
  label: string;
  wialonUnitId?: number | null;
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
  is_active?: boolean;
}

interface LayerState {
  vehicles: boolean;
  tracks: boolean;
  geofences: boolean;
  routes: boolean;
}

interface RouteWaypoint {
  id: string;
  geofenceId?: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'pickup' | 'delivery' | 'stop';
  sequence?: number;
}

interface PendingGeofenceEvent {
  type: 'entry' | 'exit';
  geofence: Geofence;
  vehicle: VehicleLocation;
  vehicleId: string;
  alias: string;
  loadId: string | null;
  dwellDurationMinutes?: number | null;
}

interface ResolvedVehicleIdentity {
  vehicleId: string;
  alias: string;
  wialonUnitId?: number;
}

const EARTH_RADIUS_KM = 6371;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const extractCoordinatePair = (coord: unknown): [number, number] | null => {
  if (Array.isArray(coord)) {
    const lng = typeof coord[0] === 'number' ? coord[0] : undefined;
    const lat = typeof coord[1] === 'number' ? coord[1] : undefined;

    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lat, lng];
    }
    return null;
  }

  if (typeof coord === 'object' && coord !== null) {
    const obj = coord as Record<string | number, unknown>;
    const latCandidates = [obj.lat, obj.latitude, obj[1]];
    const lngCandidates = [obj.lng, obj.longitude, obj[0]];
    const lat = latCandidates.find(value => typeof value === 'number');
    const lng = lngCandidates.find(value => typeof value === 'number');

    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lat, lng];
    }
  }

  return null;
};

const normalizeGeofenceCoordinates = (coordinates: Geofence['coordinates']): [number, number][] => {
  if (!coordinates) return [];

  const points: [number, number][] = [];

  const processValue = (value: unknown) => {
    if (Array.isArray(value)) {
      if (value.length === 2 && value.every(item => typeof item === 'number')) {
        const pair = extractCoordinatePair(value);
        if (pair) points.push(pair);
        return;
      }

      value.forEach(item => processValue(item));
      return;
    }

    if (typeof value === 'object' && value !== null) {
      const maybeCoords = (value as { coordinates?: unknown }).coordinates;
      if (maybeCoords) {
        processValue(maybeCoords);
        return;
      }
    }

    const pair = extractCoordinatePair(value);
    if (pair) points.push(pair);
  };

  processValue(coordinates);
  return points;
};

const isPointInsidePolygon = (point: [number, number], vertices: [number, number][]): boolean => {
  let inside = false;
  const [pointLat, pointLng] = point;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [latI, lngI] = vertices[i];
    const [latJ, lngJ] = vertices[j];

    const intersects = (lngI > pointLng) !== (lngJ > pointLng) &&
      pointLat < ((latJ - latI) * (pointLng - lngI)) / ((lngJ - lngI) || Number.EPSILON) + latI;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isVehicleInsideGeofence = (vehicle: VehicleLocation, geofence: Geofence): boolean => {
  if (geofence.type === 'circle') {
    if (
      typeof geofence.center_lat === 'number' &&
      typeof geofence.center_lng === 'number' &&
      typeof geofence.radius === 'number'
    ) {
      const distanceMeters = calculateDistance(
        vehicle.latitude,
        vehicle.longitude,
        geofence.center_lat,
        geofence.center_lng
      ) * 1000;
      return distanceMeters <= geofence.radius;
    }
    return false;
  }

  if (geofence.type === 'polygon') {
    const vertices = normalizeGeofenceCoordinates(geofence.coordinates);
    if (vertices.length >= 3) {
      return isPointInsidePolygon([vehicle.latitude, vehicle.longitude], vertices);
    }
  }

  return false;
};

// Map Controller Component for zoom controls
const MapController: React.FC<{
  onFitVehicles: () => void;
  vehicleCount: number;
}> = ({ onFitVehicles, vehicleCount }) => {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-left mt-20 ml-2.5">
      <div className="leaflet-control leaflet-bar bg-white rounded-lg shadow-lg">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-t-lg border-b"
                onClick={() => map.zoomIn()}
              >
                +
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom In</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 border-b"
                onClick={() => map.zoomOut()}
              >
                −
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom Out</TooltipContent>
          </Tooltip>
          {vehicleCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  title="Fit All Vehicles"
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-b-lg"
                  onClick={onFitVehicles}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Fit All Vehicles</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
};

const UnifiedMapView: React.FC = () => {
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);

  // Wialon Integration
  const {
    isConnected: wialonConnected,
    isLoading: wialonLoading,
    error: wialonError,
    vehicleLocations,
    connect: connectWialon,
    disconnect: disconnectWialon,
    refreshUnits,
    callAPI: callWialonAPI
  } = useWialonContext();

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<'all' | 'moving' | 'stopped'>('all');
  const [activeTab, setActiveTab] = useState('vehicles');

  // State Management
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [activeTracks, setActiveTracks] = useState<Map<string, VehicleTrack>>(new Map());
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [selectedGeofences, setSelectedGeofences] = useState<Set<string>>(new Set());
  const [routeWaypoints, setRouteWaypoints] = useState<RouteWaypoint[]>([]);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [isSaveRouteDialogOpen, setIsSaveRouteDialogOpen] = useState(false);
  const geofenceStateRef = useRef<Map<string, VehicleGeofenceState>>(new Map());
  const missingVehicleWarningRef = useRef<Set<string>>(new Set());
  const [vehicleIdByWialon, setVehicleIdByWialon] = useState<Map<number, { id: string; label: string }>>(new Map());
  const [vehicleAliasLookup, setVehicleAliasLookup] = useState<Map<string, VehicleAliasInfo>>(new Map());
  const [unitLoadMap, setUnitLoadMap] = useState<Map<number, string | null>>(new Map());
  const [layerVisibility, setLayerVisibility] = useState<LayerState>({
    vehicles: true,
    tracks: true,
    geofences: true,
    routes: true
  });

  // Report Results Panel State
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [isReportPanelOpen, setIsReportPanelOpen] = useState(false);
  const [isReportPanelExpanded, setIsReportPanelExpanded] = useState(false);

  // Live Vehicle Data Panel State
  const [isVehicleDataPanelOpen, setIsVehicleDataPanelOpen] = useState(false);
  const [isVehicleDataPanelExpanded, setIsVehicleDataPanelExpanded] = useState(false);

  // Saved Routes Hook
  const { routes: savedRoutes = [], isLoading: loadingSavedRoutes, loadRouteTemplate } = useSavedRoutes();

  // Track Visualization State
  const [trackVisualization, setTrackVisualization] = useState({
    isEnabled: false,
    selectedDate: new Date().toISOString().split('T')[0],
    timeRange: {
      start: '00:00',
      end: '23:59'
    }
  });

  // Map Configuration
  const defaultCenter = useMemo<[number, number]>(() => [-26.2041, 28.0473], []); // Johannesburg
  const defaultZoom = 10;

  // Filtered vehicles based on search and status
  const filteredVehicles = useMemo(() => {
    return vehicleLocations.filter(vehicle => {
      // Search filter
      if (vehicleSearchQuery) {
        const query = vehicleSearchQuery.toLowerCase();
        if (!vehicle.vehicleName.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Status filter
      if (vehicleStatusFilter === 'moving' && vehicle.speed <= 0) return false;
      if (vehicleStatusFilter === 'stopped' && vehicle.speed > 0) return false;
      return true;
    });
  }, [vehicleLocations, vehicleSearchQuery, vehicleStatusFilter]);

  // Vehicle statistics
  const vehicleStats = useMemo(() => {
    const moving = vehicleLocations.filter(v => v.speed > 0).length;
    const stopped = vehicleLocations.length - moving;
    return { total: vehicleLocations.length, moving, stopped };
  }, [vehicleLocations]);

  // Fit map to all vehicles
  const fitMapToVehicles = useCallback(() => {
    if (mapRef.current && vehicleLocations.length > 0) {
      const bounds = L.latLngBounds(
        vehicleLocations.map(v => [v.latitude, v.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vehicleLocations]);

  // Focus on a specific vehicle
  const focusOnVehicle = useCallback((vehicle: VehicleLocation) => {
    if (mapRef.current) {
      mapRef.current.setView([vehicle.latitude, vehicle.longitude], 15, {
        animate: true,
        duration: 0.5
      });
    }
    setSelectedVehicle(vehicle.vehicleId);
  }, []);

  // Load Geofences
  const loadGeofences = useCallback(async () => {
    try {
      // Bypass TypeScript checking for geofences table that's not in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('geofences')
        .select('*')
        .eq('is_active', true)
        .order('name');

      console.log(`Loaded ${data?.length || 0} geofences`);
      setGeofences((data as Geofence[]) || []);
    } catch (error) {
      console.error('Failed to load geofences:', error);
      // Silently fail - geofences might not be configured
    }
  }, []);

  const loadVehicleMetadata = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('wialon_vehicles')
        .select('id, wialon_unit_id, name, fleet_number, registration');

      if (error) throw error;

      const wialonMap = new Map<number, { id: string; label: string }>();
      const aliasMap = new Map<string, VehicleAliasInfo>();

      data?.forEach(vehicle => {
        if (typeof vehicle.wialon_unit_id !== 'number') {
          return;
        }

        const label = vehicle.fleet_number || vehicle.registration || vehicle.name || `Unit ${vehicle.wialon_unit_id}`;
        wialonMap.set(vehicle.wialon_unit_id, { id: vehicle.id, label });
        aliasMap.set(vehicle.id, {
          label,
          wialonUnitId: vehicle.wialon_unit_id,
        });
      });

      setVehicleIdByWialon(wialonMap);
      setVehicleAliasLookup(aliasMap);
    } catch (error) {
      console.error('Failed to load vehicle metadata:', error);
    }
  }, []);

  const loadUnitAssignments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('wialon_unit_map')
        .select('unit_id, load_id');

      if (error) throw error;

      const assignments = new Map<number, string | null>();
      data?.forEach(record => {
        if (typeof record.unit_id === 'number') {
          assignments.set(record.unit_id, record.load_id);
        }
      });

      setUnitLoadMap(assignments);
    } catch (error) {
      console.error('Failed to load unit assignments:', error);
    }
  }, []);

  const resolveVehicleIdentifiers = useCallback((vehicle: VehicleLocation): ResolvedVehicleIdentity | null => {
    const parsedUnitId = vehicle.unitId ? Number(vehicle.unitId) : undefined;

    if (typeof parsedUnitId === 'number' && vehicleIdByWialon.has(parsedUnitId)) {
      const mapping = vehicleIdByWialon.get(parsedUnitId)!;
      const aliasInfo = vehicleAliasLookup.get(mapping.id);
      return {
        vehicleId: mapping.id,
        alias: aliasInfo?.label || mapping.label || vehicle.vehicleName,
        wialonUnitId: parsedUnitId,
      };
    }

    if (vehicleAliasLookup.has(vehicle.vehicleId)) {
      const aliasInfo = vehicleAliasLookup.get(vehicle.vehicleId)!;
      return {
        vehicleId: vehicle.vehicleId,
        alias: aliasInfo.label,
        wialonUnitId: aliasInfo.wialonUnitId ?? parsedUnitId,
      };
    }

    if (!missingVehicleWarningRef.current.has(vehicle.vehicleId)) {
      missingVehicleWarningRef.current.add(vehicle.vehicleId);
      console.warn(
        `Skipping geofence logging for ${vehicle.vehicleName} (${vehicle.vehicleId}). No Wialon mapping found.`
      );
    }

    return null;
  }, [vehicleAliasLookup, vehicleIdByWialon]);

  const logGeofenceEvent = useCallback(async (event: PendingGeofenceEvent) => {
    try {
      const { error } = await supabase.from('geofence_events').insert({
        event_type: event.type,
        geofence_zone_id: event.geofence.id,
        vehicle_id: event.vehicleId,
        load_id: event.loadId,
        latitude: event.vehicle.latitude,
        longitude: event.vehicle.longitude,
        dwell_duration_minutes: event.dwellDurationMinutes ?? null,
        event_timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      if (event.type === 'entry') {
        toast({
          title: 'Geofence Entry',
          description: `${event.alias} entered ${event.geofence.name}`,
        });
      } else {
        console.info(`${event.alias} exited ${event.geofence.name}`);
      }
    } catch (error) {
      console.error('Failed to log geofence event:', error);
      toast({
        title: 'Geofence logging failed',
        description: error instanceof Error ? error.message : 'Unknown error logging geofence event',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Generate Vehicle Track - Real-time Implementation
  const generateVehicleTrack = useCallback(async (vehicleId: string, vehicleName: string) => {
    if (activeTracks.has(vehicleId)) {
      toast({
        title: "Track Already Active",
        description: `Track for ${vehicleName} is already displayed`,
        variant: "destructive"
      });
      return;
    }

    if (!wialonConnected) {
      toast({
        title: "Not Connected",
        description: "Connect to Wialon to load real GPS tracks",
        variant: "destructive"
      });
      return;
    }

    try {
      // Find the vehicle to get its Wialon unit ID
      const vehicle = vehicleLocations.find(v => v.vehicleId === vehicleId);

      if (!vehicle) {
        throw new Error(`Vehicle ${vehicleName} not found in current locations`);
      }

      if (!vehicle.wialonUnitId) {
        throw new Error(`Vehicle ${vehicleName} does not have a Wialon unit ID. Check vehicle mapping.`);
      }

      const wialonUnitId = vehicle.wialonUnitId;

      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      const color = colors[activeTracks.size % colors.length];

      // Calculate time range based on trackVisualization settings
      const selectedDate = new Date(trackVisualization.selectedDate);
      const [startHour, startMin] = trackVisualization.timeRange.start.split(':').map(Number);
      const [endHour, endMin] = trackVisualization.timeRange.end.split(':').map(Number);

      const timeFrom = new Date(selectedDate);
      timeFrom.setHours(startHour, startMin, 0, 0);

      const timeTo = new Date(selectedDate);
      timeTo.setHours(endHour, endMin, 59, 999);

      const fromTimestamp = Math.floor(timeFrom.getTime() / 1000);
      const toTimestamp = Math.floor(timeTo.getTime() / 1000);

      // Validate timestamps
      if (!fromTimestamp || !toTimestamp || fromTimestamp >= toTimestamp) {
        throw new Error('Invalid time range. Please check your date and time settings.');
      }

      console.log(`📡 Loading track for ${vehicleName} (Unit ID: ${wialonUnitId}) from ${timeFrom.toISOString()} to ${timeTo.toISOString()}`);

      // Step 1: Load interval to prepare messages
      const loadData = await callWialonAPI('messages/load_interval', {
        itemId: wialonUnitId,
        timeFrom: fromTimestamp,
        timeTo: toTimestamp,
        flags: 0x0000,
        flagsMask: 0xff00,
        loadCount: 10000
      }) as { error?: number; totalCount?: number; messagesCount?: number };

      if (loadData.error) {
        throw new Error(`Wialon API Error: ${loadData.error}`);
      }

      let trackPoints: TrackPoint[] = [];
      let isDemo = false; // Single declaration

      if (loadData.totalCount && loadData.totalCount > 0) {
        console.log(`✅ Found ${loadData.totalCount} GPS messages`);

        // Step 2: Get the actual messages
        const getData = await callWialonAPI('messages/get_messages', {
          indexFrom: 0,
          indexTo: Math.min(loadData.totalCount - 1, 9999)
        }) as { messages?: Array<{ pos?: { y: number; x: number; t: number; s?: number } }> };

        if (getData.messages && Array.isArray(getData.messages)) {
          trackPoints = getData.messages
            .map((msg) => {
              if (!msg.pos || !msg.pos.y || !msg.pos.x) return null;
              return {
                lat: msg.pos.y,
                lng: msg.pos.x,
                timestamp: msg.pos.t * 1000, // Convert to milliseconds
                speed: msg.pos.s
              } as TrackPoint;
            })
            .filter((point): point is TrackPoint => point !== null)
            .reverse(); // Oldest first

          console.log(`✅ Processed ${trackPoints.length} valid GPS points`);
        }
      }

      // Fallback: Use current position if no historical data
      if (trackPoints.length === 0) {
        console.log(`📍 No historical data, using current position for ${vehicleName}`);
        const vehicle = vehicleLocations.find(v => v.vehicleId === vehicleId);

        if (vehicle) {
          trackPoints = [{
            lat: vehicle.latitude,
            lng: vehicle.longitude,
            timestamp: Date.now(),
            speed: vehicle.speed
          }];
          console.log(`✅ Using current position as single track point`);
          // Mark as demo since we're using current position instead of historical track
          isDemo = true;
        } else {
          // No data available - throw error instead of generating demo
          console.log(`❌ No GPS data available for ${vehicleName}`);
          throw new Error(`No GPS data available for ${vehicleName}. The vehicle may not have reported its position.`);
        }
      }

      // Calculate total mileage
      let totalMileage = 0;
      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i - 1];
        const current = trackPoints[i];
        totalMileage += calculateDistance(prev.lat, prev.lng, current.lat, current.lng);
      }

      const newTrack: VehicleTrack = {
        unitId: vehicleId,
        unitName: vehicleName,
        color,
        points: trackPoints,
        isVisible: true,
        isDemo,
        mileage: Math.round(totalMileage * 10) / 10
      };

      setActiveTracks(prev => new Map(prev).set(vehicleId, newTrack));

      // Fit map to track bounds if we have multiple points
      if (mapRef.current && trackPoints.length > 1) {
        const bounds = L.latLngBounds(trackPoints.map(p => [p.lat, p.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }

      toast({
        title: "Track Loaded",
        description: `${isDemo ? 'Demo' : 'Real GPS'} track for ${vehicleName}: ${trackPoints.length} points, ${newTrack.mileage} km`,
      });

    } catch (error) {
      console.error('Error generating track:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate vehicle track",
        variant: "destructive"
      });
    }
  }, [activeTracks, vehicleLocations, wialonConnected, trackVisualization, toast, callWialonAPI]);

  // Toggle Track Visibility
  const toggleTrackVisibility = useCallback((vehicleId: string) => {
    setActiveTracks(prev => {
      const newTracks = new Map(prev);
      const track = newTracks.get(vehicleId);
      if (track) {
        newTracks.set(vehicleId, { ...track, isVisible: !track.isVisible });
      }
      return newTracks;
    });
  }, []);

  // Remove Track
  const removeTrack = useCallback((vehicleId: string) => {
    setActiveTracks(prev => {
      const newTracks = new Map(prev);
      newTracks.delete(vehicleId);
      return newTracks;
    });
  }, []);

  // Clear All Tracks
  const clearAllTracks = useCallback(() => {
    setActiveTracks(new Map());
    toast({
      title: "Tracks Cleared",
      description: "All vehicle tracks have been removed"
    });
  }, [toast]);

  // Toggle Layer Visibility
  const toggleLayer = useCallback((layer: keyof LayerState) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  }, []);

  // Route Planning Functions
  const toggleGeofenceSelection = useCallback((geofenceId: string) => {
    setSelectedGeofences(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(geofenceId)) {
        newSelection.delete(geofenceId);
      } else {
        newSelection.add(geofenceId);
      }
      return newSelection;
    });
  }, []);

  const addGeofenceToRoute = useCallback((geofence: Geofence, type: 'pickup' | 'delivery' | 'stop') => {
    if (!geofence.center_lat || !geofence.center_lng) {
      toast({
        title: "Invalid Geofence",
        description: "This geofence doesn't have valid coordinates",
        variant: "destructive"
      });
      return;
    }

    const waypoint: RouteWaypoint = {
      id: `wp-${Date.now()}`,
      geofenceId: geofence.id,
      name: geofence.name,
      latitude: geofence.center_lat,
      longitude: geofence.center_lng,
      type,
      sequence: routeWaypoints.length
    };

    setRouteWaypoints(prev => [...prev, waypoint]);
    setSelectedGeofences(prev => {
      const newSelection = new Set(prev);
      newSelection.add(geofence.id);
      return newSelection;
    });

    toast({
      title: "Waypoint Added",
      description: `${geofence.name} added as ${type} point`
    });
  }, [routeWaypoints.length, toast]);

  const removeWaypoint = useCallback((waypointId: string) => {
    setRouteWaypoints(prev => prev.filter(wp => wp.id !== waypointId));
  }, []);

  const moveWaypointUp = useCallback((index: number) => {
    if (index === 0) return; // Already at top
    setRouteWaypoints(prev => {
      const newWaypoints = [...prev];
      [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
      // Update sequences
      return newWaypoints.map((wp, idx) => ({ ...wp, sequence: idx }));
    });
  }, []);

  const moveWaypointDown = useCallback((index: number) => {
    setRouteWaypoints(prev => {
      if (index === prev.length - 1) return prev; // Already at bottom
      const newWaypoints = [...prev];
      [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
      // Update sequences
      return newWaypoints.map((wp, idx) => ({ ...wp, sequence: idx }));
    });
  }, []);

  const clearRoute = useCallback(() => {
    setRouteWaypoints([]);
    setSelectedGeofences(new Set());
    setIsCreatingRoute(false);
    toast({
      title: "Route Cleared",
      description: "All waypoints have been removed"
    });
  }, [toast]);

  const calculateRouteDistance = useCallback(() => {
    if (routeWaypoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < routeWaypoints.length; i++) {
      const prev = routeWaypoints[i - 1];
      const current = routeWaypoints[i];
      totalDistance += calculateDistance(prev.latitude, prev.longitude, current.latitude, current.longitude);
    }
    return Math.round(totalDistance * 10) / 10;
  }, [routeWaypoints]);

  const optimizeRoute = useCallback(() => {
    if (routeWaypoints.length < 2) {
      toast({
        title: "Not Enough Waypoints",
        description: "Need at least 2 waypoints to optimize",
        variant: "destructive"
      });
      return;
    }

    // Simple nearest neighbor optimization
    const optimized: RouteWaypoint[] = [routeWaypoints[0]]; // Start with first waypoint
    const remaining = [...routeWaypoints.slice(1)];

    while (remaining.length > 0) {
      const current = optimized[optimized.length - 1];
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((wp, index) => {
        const dist = calculateDistance(current.latitude, current.longitude, wp.latitude, wp.longitude);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestIndex = index;
        }
      });

      optimized.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }

    // Update sequences
    const resequenced = optimized.map((wp, index) => ({ ...wp, sequence: index }));
    setRouteWaypoints(resequenced);

    toast({
      title: "Route Optimized",
      description: `Distance: ${calculateRouteDistance()} km`
    });
  }, [routeWaypoints, calculateRouteDistance, toast]);

  // Calculate estimated duration (assumes average 60 km/h)
  const calculateEstimatedDuration = useCallback(() => {
    const distance = calculateRouteDistance();
    const avgSpeedKmh = 60;
    return Math.round((distance / avgSpeedKmh) * 60); // minutes
  }, [calculateRouteDistance]);

  // Load a saved route template
  const handleLoadRouteTemplate = useCallback((routeId: string) => {
    const template = savedRoutes.find(r => r.id === routeId);
    if (!template) return;

    const waypoints: RouteWaypoint[] = template.waypoints.map((wp, index) => ({
      id: `${wp.geofence_id || `wp-${Date.now()}-${index}`}`,
      name: wp.name,
      latitude: wp.latitude,
      longitude: wp.longitude,
      type: wp.type as 'pickup' | 'delivery' | 'stop',
      sequence: wp.sequence,
      geofenceId: wp.geofence_id,
    }));

    setRouteWaypoints(waypoints);
    loadRouteTemplate(routeId); // Increment usage count

    toast({
      title: "Route Loaded",
      description: `Loaded ${template.name} with ${waypoints.length} waypoints`,
    });

    // Fit map to route bounds
    if (mapRef.current && waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(wp => [wp.latitude, wp.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [savedRoutes, loadRouteTemplate, toast]);

  // Load data on mount
  useEffect(() => {
    loadGeofences();
  }, [loadGeofences]);

  useEffect(() => {
    loadVehicleMetadata();
  }, [loadVehicleMetadata]);

  useEffect(() => {
    loadUnitAssignments();
    const interval = setInterval(loadUnitAssignments, 60000);
    return () => clearInterval(interval);
  }, [loadUnitAssignments]);

  useEffect(() => {
    if (!wialonConnected || geofences.length === 0 || vehicleLocations.length === 0) {
      return;
    }

    const eventsToPersist: PendingGeofenceEvent[] = [];

    vehicleLocations.forEach((vehicle) => {
      const resolved = resolveVehicleIdentifiers(vehicle);
      if (!resolved) return;

      const { vehicleId, alias, wialonUnitId } = resolved;
      const numericUnitId = typeof wialonUnitId === 'number'
        ? wialonUnitId
        : vehicle.unitId
          ? Number(vehicle.unitId)
          : undefined;
      const associatedLoadId = typeof numericUnitId === 'number'
        ? unitLoadMap.get(numericUnitId) ?? null
        : null;

      const state = geofenceStateRef.current.get(vehicleId) ?? {
        inside: new Set<string>(),
        enterTimestamps: new Map<string, number>(),
      };

      geofences.forEach((geofence) => {
        if (geofence.is_active === false) return;

        const isInside = isVehicleInsideGeofence(vehicle, geofence);

        if (isInside && !state.inside.has(geofence.id)) {
          state.inside.add(geofence.id);
          state.enterTimestamps.set(geofence.id, Date.now());
          eventsToPersist.push({
            type: 'entry',
            geofence,
            vehicle,
            vehicleId,
            alias,
            loadId: associatedLoadId,
          });
        } else if (!isInside && state.inside.has(geofence.id)) {
          state.inside.delete(geofence.id);
          const enteredAt = state.enterTimestamps.get(geofence.id);
          state.enterTimestamps.delete(geofence.id);
          const dwellDurationMinutes = enteredAt
            ? Math.max(1, Math.round((Date.now() - enteredAt) / 60000))
            : null;

          eventsToPersist.push({
            type: 'exit',
            geofence,
            vehicle,
            vehicleId,
            alias,
            loadId: associatedLoadId,
            dwellDurationMinutes,
          });
        }
      });

      geofenceStateRef.current.set(vehicleId, state);
    });

    if (eventsToPersist.length > 0) {
      eventsToPersist.forEach(event => {
        void logGeofenceEvent(event);
      });
    }
  }, [
    geofences,
    vehicleLocations,
    wialonConnected,
    resolveVehicleIdentifiers,
    unitLoadMap,
    logGeofenceEvent,
  ]);

  // Auto-connect to Wialon if not connected
  useEffect(() => {
    if (!wialonConnected && !wialonError && !wialonLoading) {
      connectWialon().catch(console.error);
    }
  }, [wialonConnected, wialonError, wialonLoading, connectWialon]);

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] bg-background">
        {/* Collapsible Sidebar - Wider when expanded */}
        <div
          className={`border-r bg-card flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-96 xl:w-[400px]'
            }`}
        >
          {/* Sidebar Header */}
          <div className="p-3 border-b flex items-center justify-between">
            {!sidebarCollapsed && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Fleet Map
              </h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 p-0"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Quick Stats Bar */}
          {!sidebarCollapsed && wialonConnected && (
            <div className="px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="font-medium">{vehicleStats.moving}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Moving Vehicles</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-medium">{vehicleStats.stopped}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Stopped Vehicles</TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="text-xs">
                  {vehicleStats.total} total
                </Badge>
              </div>
            </div>
          )}

          {sidebarCollapsed ? (
            /* Collapsed Sidebar - Icon Only */
            <div className="flex-1 flex flex-col items-center py-4 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'vehicles' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('vehicles'); setSidebarCollapsed(false); }}
                  >
                    <Truck className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Vehicles</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'tracks' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('tracks'); setSidebarCollapsed(false); }}
                  >
                    <History className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Track History</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'geofences' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('geofences'); setSidebarCollapsed(false); }}
                  >
                    <Shield className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Geofences</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'routes' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('routes'); setSidebarCollapsed(false); }}
                  >
                    <RouteIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Routes</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'layers' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('layers'); setSidebarCollapsed(false); }}
                  >
                    <Layers className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Layers</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('table'); setSidebarCollapsed(false); }}
                  >
                    <List className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Table View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === 'reports' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => { setActiveTab('reports'); setSidebarCollapsed(false); }}
                  >
                    <FileBarChart className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Reports</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Expanded Sidebar */
            <div className="flex-1 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-7 mx-3 mt-3" style={{ width: 'calc(100% - 1.5rem)' }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="vehicles" className="px-2">
                        <Truck className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Vehicles</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="tracks" className="px-2">
                        <History className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Track History</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="geofences" className="px-2">
                        <Shield className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Geofences</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="routes" className="px-2">
                        <RouteIcon className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Routes</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="layers" className="px-2">
                        <Layers className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Layers</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="table" className="px-2">
                        <List className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Table View</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="reports" className="px-2">
                        <FileBarChart className="h-4 w-4" />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Reports</TooltipContent>
                  </Tooltip>
                </TabsList>

                {/* Vehicles Tab */}
                <TabsContent value="vehicles" className="flex-1 overflow-hidden px-3 mt-3">
                  <div className="space-y-3 h-full flex flex-col">
                    {/* Connection Status */}
                    <Card className="shrink-0">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Zap className={`h-4 w-4 ${wialonConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
                            Wialon
                          </span>
                          <Badge
                            variant={wialonConnected ? "default" : "secondary"}
                            className={wialonConnected ? "bg-green-500" : ""}
                          >
                            {wialonConnected ? "Live" : "Offline"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="flex gap-2">
                          {!wialonConnected ? (
                            <Button
                              size="sm"
                              onClick={connectWialon}
                              disabled={wialonLoading}
                              className="w-full"
                            >
                              {wialonLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Connecting...
                                </>
                              ) : (
                                "Connect"
                              )}
                            </Button>
                          ) : (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={refreshUnits}
                                    className="flex-1"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Refresh Vehicles</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={fitMapToVehicles}
                                    className="flex-1"
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Fit All Vehicles</TooltipContent>
                              </Tooltip>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={disconnectWialon}
                                className="flex-1"
                              >
                                Disconnect
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vehicle Search & Filter */}
                    {wialonConnected && (
                      <div className="shrink-0 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search vehicles..."
                            value={vehicleSearchQuery}
                            onChange={(e) => setVehicleSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                          />
                          {vehicleSearchQuery && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1 h-7 w-7 p-0"
                              onClick={() => setVehicleSearchQuery('')}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={vehicleStatusFilter === 'all' ? 'default' : 'outline'}
                            onClick={() => setVehicleStatusFilter('all')}
                            className="flex-1 h-7 text-xs"
                          >
                            All
                          </Button>
                          <Button
                            size="sm"
                            variant={vehicleStatusFilter === 'moving' ? 'default' : 'outline'}
                            onClick={() => setVehicleStatusFilter('moving')}
                            className="flex-1 h-7 text-xs"
                          >
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                            Moving
                          </Button>
                          <Button
                            size="sm"
                            variant={vehicleStatusFilter === 'stopped' ? 'default' : 'outline'}
                            onClick={() => setVehicleStatusFilter('stopped')}
                            className="flex-1 h-7 text-xs"
                          >
                            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
                            Stopped
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Vehicle List */}
                    {wialonConnected && (
                      <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-2 pt-3 px-3">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>
                              Vehicles
                              {vehicleSearchQuery && (
                                <span className="text-muted-foreground ml-1">
                                  ({filteredVehicles.length} of {vehicleLocations.length})
                                </span>
                              )}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto px-3 pb-3">
                          <div className="space-y-2">
                            {filteredVehicles.length === 0 ? (
                              <div className="text-center py-8 text-sm text-muted-foreground">
                                {vehicleSearchQuery ? 'No vehicles match your search' : 'No vehicles available'}
                              </div>
                            ) : (
                              filteredVehicles.map((vehicle) => (
                                <div
                                  key={vehicle.vehicleId}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedVehicle === vehicle.vehicleId
                                      ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                      : 'bg-background hover:bg-muted'
                                    }`}
                                  onClick={() => focusOnVehicle(vehicle)}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-sm truncate">
                                        {vehicle.vehicleName}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {selectedVehicle === vehicle.vehicleId && (
                                          <Badge variant="default" className="text-xs h-5">
                                            <Zap className="h-3 w-3 mr-1" />
                                            Live
                                          </Badge>
                                        )}
                                        {trackVisualization.isEnabled && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  generateVehicleTrack(vehicle.vehicleId, vehicle.vehicleName);
                                                }}
                                                className="h-6 w-6 p-0"
                                                disabled={activeTracks.has(vehicle.vehicleId)}
                                              >
                                                <Play className="h-3 w-3" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Load Track History</TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${vehicle.speed > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                                          }`} />
                                        <span className={vehicle.speed > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                          {vehicle.speed > 0 ? 'Moving' : 'Stopped'}
                                        </span>
                                      </div>
                                      <span className="font-mono font-medium">{Math.round(vehicle.speed)} km/h</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Tracks Tab */}
                <TabsContent value="tracks" className="flex-1 overflow-hidden px-3 mt-3">
                  <div className="space-y-4 h-full flex flex-col">
                    {/* Track Controls */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          Track Visualization
                          <Button
                            size="sm"
                            variant={trackVisualization.isEnabled ? "default" : "outline"}
                            onClick={() => setTrackVisualization(prev => ({
                              ...prev,
                              isEnabled: !prev.isEnabled
                            }))}
                          >
                            {trackVisualization.isEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      {trackVisualization.isEnabled && (
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-xs mb-1 block">Date</Label>
                            <DatePicker
                              value={new Date(trackVisualization.selectedDate)}
                              onChange={(date) => setTrackVisualization(prev => ({
                                ...prev,
                                selectedDate: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                              }))}
                              placeholder="Select date"
                              className="w-full text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1 block">Time Range</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">From</Label>
                                <Input
                                  type="time"
                                  value={trackVisualization.timeRange.start}
                                  onChange={(e) => setTrackVisualization(prev => ({
                                    ...prev,
                                    timeRange: { ...prev.timeRange, start: e.target.value }
                                  }))}
                                  className="text-xs h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">To</Label>
                                <Input
                                  type="time"
                                  value={trackVisualization.timeRange.end}
                                  onChange={(e) => setTrackVisualization(prev => ({
                                    ...prev,
                                    timeRange: { ...prev.timeRange, end: e.target.value }
                                  }))}
                                  className="text-xs h-8"
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>

                    {/* Load Vehicle Track */}
                    {trackVisualization.isEnabled && wialonConnected && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Load Historical Route</CardTitle>
                          <CardDescription className="text-xs">
                            Select a vehicle to view its historical GPS track
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {/* Vehicle Quick Select */}
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {vehicleLocations.map((vehicle) => (
                                <Button
                                  key={vehicle.vehicleId}
                                  variant={activeTracks.has(vehicle.vehicleId) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => generateVehicleTrack(vehicle.vehicleId, vehicle.vehicleName)}
                                  disabled={activeTracks.has(vehicle.vehicleId)}
                                  className="h-auto py-2 px-2 flex-col items-start text-left"
                                >
                                  <div className="flex items-center gap-1.5 w-full">
                                    {activeTracks.has(vehicle.vehicleId) ? (
                                      <History className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <Play className="h-3 w-3 shrink-0" />
                                    )}
                                    <span className="text-xs font-medium truncate flex-1">
                                      {vehicle.vehicleName}
                                    </span>
                                  </div>
                                  {activeTracks.has(vehicle.vehicleId) && (
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      ✓ Loaded
                                    </span>
                                  )}
                                </Button>
                              ))}
                            </div>
                            {vehicleLocations.length === 0 && (
                              <div className="text-center py-4 text-xs text-muted-foreground">
                                No vehicles available. Check Wialon connection.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Active Tracks */}
                    {activeTracks.size > 0 ? (
                      <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center justify-between">
                            Active Tracks ({activeTracks.size})
                            <Button size="sm" variant="ghost" onClick={clearAllTracks}>
                              <X className="h-3 w-3 mr-1" />
                              Clear All
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
                          <div className="space-y-2">
                            {Array.from(activeTracks.values()).map(track => (
                              <div key={track.unitId} className="flex items-center gap-2 p-2 bg-background rounded border">
                                <div
                                  className="w-3 h-3 rounded-full border shrink-0"
                                  style={{ backgroundColor: track.color }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{track.unitName}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{track.mileage} km</span>
                                    <span>•</span>
                                    <span>{track.points.length} points</span>
                                    {track.isDemo && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1">Demo</Badge>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleTrackVisibility(track.unitId)}
                                        className="h-7 w-7 p-0"
                                      >
                                        {track.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{track.isVisible ? 'Hide' : 'Show'} Track</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeTrack(track.unitId)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove Track</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : trackVisualization.isEnabled ? (
                      <Card className="flex-1 flex flex-col">
                        <CardContent className="flex-1 flex items-center justify-center p-8">
                          <div className="text-center space-y-3">
                            <History className="h-12 w-12 mx-auto text-muted-foreground/50" />
                            <h3 className="font-medium text-sm">No Tracks Loaded</h3>
                            <p className="text-xs text-muted-foreground max-w-xs">
                              Click on any vehicle button above to load its historical GPS route for the selected date and time range
                            </p>
                            <div className="pt-2 flex justify-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                <Play className="h-3 w-3 mr-1" />
                                Click to load
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                <History className="h-3 w-3 mr-1" />
                                Shows loaded
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="flex-1 flex flex-col">
                        <CardContent className="flex-1 flex items-center justify-center p-8">
                          <div className="text-center space-y-3">
                            <History className="h-12 w-12 mx-auto text-muted-foreground/50" />
                            <h3 className="font-medium text-sm">Track Visualization Disabled</h3>
                            <p className="text-xs text-muted-foreground max-w-xs">
                              Click <strong>"Disabled"</strong> button above to enable historical route tracking
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Geofences Tab */}
                <TabsContent value="geofences" className="flex-1 overflow-hidden px-4">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        Geofences ({geofences.length})
                        <Button
                          size="sm"
                          variant={isCreatingRoute ? "default" : "outline"}
                          onClick={() => setIsCreatingRoute(!isCreatingRoute)}
                        >
                          {isCreatingRoute ? "Creating Route" : "Create Route"}
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                      <div className="space-y-2">
                        {geofences.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-8">
                            No geofences available
                          </div>
                        ) : (
                          geofences.map(geofence => {
                            const isSelected = selectedGeofences.has(geofence.id);
                            return (
                              <div
                                key={geofence.id}
                                className={`p-3 border rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-muted'
                                  }`}
                                onClick={() => {
                                  if (isCreatingRoute) {
                                    toggleGeofenceSelection(geofence.id);
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="font-medium text-sm truncate hover:text-clip hover:whitespace-normal hover:break-words">
                                          {geofence.name}
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        <p className="font-semibold">{geofence.name}</p>
                                        {geofence.description && <p className="text-xs mt-1">{geofence.description}</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {geofence.type}
                                      </Badge>
                                      {geofence.color && (
                                        <div
                                          className="w-3 h-3 rounded-full border"
                                          style={{ backgroundColor: geofence.color }}
                                        />
                                      )}
                                    </div>
                                    {geofence.description && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <p className="text-xs text-muted-foreground mt-1 truncate">
                                            {geofence.description}
                                          </p>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-xs">
                                          {geofence.description}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                  {isCreatingRoute && geofence.center_lat && geofence.center_lng && (
                                    <div className="flex gap-1 shrink-0">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addGeofenceToRoute(geofence, 'pickup');
                                            }}
                                            className="text-xs h-7 w-7 p-0"
                                          >
                                            📦
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Add as Pickup</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addGeofenceToRoute(geofence, 'delivery');
                                            }}
                                            className="text-xs h-7 w-7 p-0"
                                          >
                                            🚚
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Add as Delivery</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Routes Tab */}
                <TabsContent value="routes" className="flex-1 overflow-hidden px-4">
                  <div className="space-y-4 h-full flex flex-col">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          Route Planning
                          {routeWaypoints.length > 0 && (
                            <Badge>{routeWaypoints.length} stops</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {routeWaypoints.length > 0 && (
                          <>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Distance:</span>
                                <span className="font-medium">{calculateRouteDistance()} km</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Est. Duration:</span>
                                <span className="font-medium">
                                  {Math.floor(calculateEstimatedDuration() / 60)}h {calculateEstimatedDuration() % 60}m
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Waypoints:</span>
                                <span className="font-medium">{routeWaypoints.length}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={optimizeRoute} className="flex-1">
                                Optimize
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setIsSaveRouteDialogOpen(true)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="destructive" onClick={clearRoute}>
                                Clear
                              </Button>
                            </div>
                          </>
                        )}
                        {routeWaypoints.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Go to Geofences tab and click "Create Route" to start adding waypoints
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Saved Routes Templates */}
                    {savedRoutes.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Saved Route Templates</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                          {loadingSavedRoutes ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
                          ) : (
                            savedRoutes.map((route) => (
                              <div key={route.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{route.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {route.waypoints.length} stops · {route.total_distance_km} km
                                    {route.usage_count > 0 && ` · Used ${route.usage_count}×`}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLoadRouteTemplate(route.id)}
                                  className="ml-2"
                                >
                                  Load
                                </Button>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {routeWaypoints.length > 0 && (
                      <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Waypoints</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
                          <div className="space-y-2">
                            {routeWaypoints.map((waypoint, index) => (
                              <div key={waypoint.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                                <div className="flex flex-col gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => moveWaypointUp(index)}
                                    disabled={index === 0}
                                    className="h-4 w-4 p-0"
                                    title="Move up"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => moveWaypointDown(index)}
                                    disabled={index === routeWaypoints.length - 1}
                                    className="h-4 w-4 p-0"
                                    title="Move down"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{waypoint.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {waypoint.type === 'pickup' ? '📦 Pickup' : waypoint.type === 'delivery' ? '🚚 Delivery' : '🛑 Stop'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeWaypoint(waypoint.id)}
                                  className="h-6 w-6 p-0"
                                  title="Remove waypoint"
                                >
                                  <Square className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Layers Tab */}
                <TabsContent value="layers" className="flex-1 overflow-hidden px-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Layer Visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(Object.keys(layerVisibility) as Array<keyof LayerState>).map(layer => (
                        <div key={layer} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{layer}</span>
                          <Button
                            size="sm"
                            variant={layerVisibility[layer] ? "default" : "outline"}
                            onClick={() => toggleLayer(layer)}
                            className="h-6"
                          >
                            {layerVisibility[layer] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Table View Tab */}
                <TabsContent value="table" className="flex-1 overflow-hidden px-3 mt-3">
                  <div className="space-y-4 h-full flex flex-col">
                    <Card>
                      <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>Live Vehicle Data</span>
                          <Badge variant="outline" className="text-xs">
                            {vehicleLocations.length} vehicles
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Real-time GPS positions from Wialon
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        {!wialonConnected ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Connect to Wialon to view vehicle data</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-muted/30 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{vehicleStats.total}</p>
                                <p className="text-xs text-muted-foreground">Total Vehicles</p>
                              </div>
                              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-green-600">{vehicleStats.moving}</p>
                                <p className="text-xs text-muted-foreground">Moving</p>
                              </div>
                              <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-yellow-600">{vehicleStats.stopped}</p>
                                <p className="text-xs text-muted-foreground">Stopped</p>
                              </div>
                              <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-blue-600">
                                  {vehicleLocations.length > 0
                                    ? Math.round(vehicleLocations.reduce((sum, v) => sum + v.speed, 0) / vehicleLocations.length)
                                    : 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Avg km/h</p>
                              </div>
                            </div>

                            {/* Open Full Table Button */}
                            <Button
                              className="w-full"
                              size="lg"
                              onClick={() => {
                                setIsVehicleDataPanelOpen(true);
                                // Close report panel if open to avoid overlap
                                if (isReportPanelOpen) {
                                  setIsReportPanelOpen(false);
                                  setIsReportPanelExpanded(false);
                                }
                              }}
                              disabled={vehicleLocations.length === 0}
                            >
                              <Maximize2 className="h-4 w-4 mr-2" />
                              Open Full Table View
                            </Button>

                            <p className="text-xs text-muted-foreground text-center">
                              Click to view detailed vehicle data in a full-width table
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent Vehicles List (condensed preview) */}
                    {wialonConnected && vehicleLocations.length > 0 && (
                      <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-2 pt-2 px-3">
                          <CardTitle className="text-xs text-muted-foreground">Quick Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto px-3 pb-3">
                          <div className="space-y-1">
                            {vehicleLocations.slice(0, 5).map((vehicle) => (
                              <div
                                key={vehicle.vehicleId}
                                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                                onClick={() => focusOnVehicle(vehicle)}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2 h-2 rounded-full ${vehicle.speed > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}
                                  />
                                  <span className="font-medium truncate max-w-[120px]">{vehicle.vehicleName}</span>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {Math.round(vehicle.speed)} km/h
                                </span>
                              </div>
                            ))}
                            {vehicleLocations.length > 5 && (
                              <p className="text-xs text-center text-muted-foreground pt-2">
                                +{vehicleLocations.length - 5} more vehicles
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Reports Tab */}
                <TabsContent value="reports" className="flex-1 overflow-hidden px-3 mt-3">
                  <MapReportPanel
                    onReportGenerated={(result) => {
                      setReportResult(result);
                      setIsReportPanelOpen(true);
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {/* Main Map Area */}
        <div className="flex-1 relative">
          {/* Sensor Widget - Shows when vehicle is selected */}
          {selectedVehicle && wialonConnected && (
            <div className="absolute top-4 right-4 z-[1000] w-96">
              {(() => {
                const vehicle = vehicleLocations.find(v => v.vehicleId === selectedVehicle);
                if (!vehicle) return null;

                // Use the wialonUnitId from the vehicle object (large integer ID from Wialon API)
                const unitId = vehicle.wialonUnitId;

                // Don't render if no valid Wialon unit ID
                if (!unitId) return null;

                return (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border shadow-sm"
                      onClick={() => setSelectedVehicle(null)}
                    >
                      ×
                    </Button>
                    <WialonSensorWidget
                      unitId={unitId}
                      title={`${vehicle.vehicleName} - Live Sensors`}
                      sensorTypes={['fuel', 'temperature', 'speed', 'engine', 'ignition']}
                      maxSensors={6}
                      autoRefresh={true}
                      refreshInterval={10000}
                      compact={false}
                      showRefreshButton={true}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Map Zoom Controls */}
            <MapController
              onFitVehicles={fitMapToVehicles}
              vehicleCount={vehicleLocations.length}
            />

            {/* Vehicle Markers */}
            {layerVisibility.vehicles && wialonConnected && vehicleLocations.map((vehicle) => {
              const isSelected = selectedVehicle === vehicle.vehicleId;
              const isMoving = vehicle.speed > 0 || vehicle.isMoving;
              const heading = vehicle.heading || 0;

              // Create icon HTML based on movement status
              const iconHtml = isMoving
                ? `<div style="
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  position: relative;
                ">
                  <div style="
                    background-color: rgba(0, 0, 0, 0.75);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    margin-bottom: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  ">${vehicle.vehicleName}</div>
                  <div style="
                    transform: rotate(${heading}deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="${isSelected ? '#3b82f6' : '#10b981'}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>`
                : `<div style="
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  position: relative;
                ">
                  <div style="
                    background-color: rgba(0, 0, 0, 0.75);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    margin-bottom: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  ">${vehicle.vehicleName}</div>
                  <div style="
                    background-color: ${isSelected ? '#3b82f6' : '#ef4444'};
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                  "></div>
                </div>`;

              return (
                <Marker
                  key={vehicle.vehicleId}
                  position={[vehicle.latitude, vehicle.longitude]}
                  icon={L.divIcon({
                    html: iconHtml,
                    className: '',
                    iconSize: [60, 50],
                    iconAnchor: [30, 50],
                  })}
                  eventHandlers={{
                    click: () => setSelectedVehicle(vehicle.vehicleId),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">{vehicle.vehicleName}</p>
                      <p>Speed: {Math.round(vehicle.speed)} km/h</p>
                      <p>Heading: {Math.round(heading)}°</p>
                      <p>Status: {isMoving ? 'Moving' : 'Stopped'}</p>
                      <p className="text-xs text-gray-500">
                        {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Vehicle Tracks */}
            {layerVisibility.tracks && Array.from(activeTracks.values())
              .filter(track => track.isVisible && track.points.length > 1)
              .map(track => (
                <Polyline
                  key={`track-${track.unitId}`}
                  positions={track.points.map(point => [point.lat, point.lng])}
                  color={track.color}
                  weight={4}
                  opacity={0.8}
                  dashArray={track.isDemo ? [10, 10] : undefined}
                />
              ))
            }

            {/* Route Visualization */}
            {layerVisibility.routes && routeWaypoints.length > 0 && (
              <>
                {/* Route Polyline - Show exact path between waypoints */}
                {routeWaypoints.length > 1 && (
                  <>
                    {/* Background line for better visibility */}
                    <Polyline
                      positions={routeWaypoints.map(wp => [wp.latitude, wp.longitude])}
                      color="#ffffff"
                      weight={7}
                      opacity={0.8}
                    />
                    {/* Main route line */}
                    <Polyline
                      positions={routeWaypoints.map(wp => [wp.latitude, wp.longitude])}
                      color="#8B5CF6"
                      weight={4}
                      opacity={1}
                    />
                    {/* Direction arrows */}
                    <Polyline
                      positions={routeWaypoints.map(wp => [wp.latitude, wp.longitude])}
                      color="#8B5CF6"
                      weight={4}
                      opacity={1}
                      dashArray="10, 10"
                    />
                  </>
                )}

                {/* Waypoint Markers */}
                {routeWaypoints.map((waypoint, index) => (
                  <Marker
                    key={waypoint.id}
                    position={[waypoint.latitude, waypoint.longitude]}
                    icon={L.divIcon({
                      html: `<div style="
                      background-color: ${waypoint.type === 'pickup' ? '#10b981' : waypoint.type === 'delivery' ? '#3b82f6' : '#f59e0b'};
                      color: white;
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      border: 3px solid white;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 14px;
                      font-weight: bold;
                    ">${index + 1}</div>`,
                      className: '',
                      iconSize: [32, 32],
                      iconAnchor: [16, 16],
                    })}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">Stop {index + 1}: {waypoint.name}</p>
                        <p className="text-xs">
                          Type: {waypoint.type === 'pickup' ? '📦 Pickup' : waypoint.type === 'delivery' ? '🚚 Delivery' : '🛑 Stop'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}

            {/* Geofences */}
            {layerVisibility.geofences && geofences.map(geofence => {
              const color = geofence.color || '#3B82F6';

              if (geofence.type === 'circle' && geofence.center_lat && geofence.center_lng) {
                return (
                  <Circle
                    key={geofence.id}
                    center={[geofence.center_lat, geofence.center_lng]}
                    radius={geofence.radius || 500}
                    color={color}
                    fillColor={color}
                    fillOpacity={0.2}
                    weight={2}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{geofence.name}</p>
                        {geofence.description && <p>{geofence.description}</p>}
                        <p className="text-xs">Type: {geofence.type}</p>
                        <p className="text-xs">Radius: {geofence.radius}m</p>
                      </div>
                    </Popup>
                  </Circle>
                );
              }

              if (geofence.type === 'polygon' && geofence.coordinates) {
                const positions: [number, number][] = Array.isArray(geofence.coordinates)
                  ? geofence.coordinates.map((coord: { lat?: number; lng?: number; 0?: number; 1?: number }): [number, number] => [coord.lat || coord[1] || 0, coord.lng || coord[0] || 0])
                  : []; if (positions.length > 0) {
                    return (
                      <Polygon
                        key={geofence.id}
                        positions={positions}
                        color={color}
                        fillColor={color}
                        fillOpacity={0.2}
                        weight={3}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-bold">{geofence.name}</p>
                            {geofence.description && <p>{geofence.description}</p>}
                            <p className="text-xs">Type: {geofence.type}</p>
                            <p className="text-xs">Points: {positions.length}</p>
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  }
              }

              return null;
            })}
          </MapContainer>

          {/* Report Results Panel - Full width at bottom */}
          <ReportResultsPanel
            reportResult={reportResult}
            isOpen={isReportPanelOpen}
            onClose={() => {
              setIsReportPanelOpen(false);
              setIsReportPanelExpanded(false);
            }}
            onToggleExpand={() => setIsReportPanelExpanded(!isReportPanelExpanded)}
            isExpanded={isReportPanelExpanded}
          />

          {/* Live Vehicle Data Panel - Full width at bottom */}
          <LiveVehicleDataPanel
            vehicleLocations={vehicleLocations}
            isConnected={wialonConnected}
            isOpen={isVehicleDataPanelOpen}
            onClose={() => {
              setIsVehicleDataPanelOpen(false);
              setIsVehicleDataPanelExpanded(false);
            }}
            onToggleExpand={() => setIsVehicleDataPanelExpanded(!isVehicleDataPanelExpanded)}
            isExpanded={isVehicleDataPanelExpanded}
            onVehicleClick={(vehicle) => {
              focusOnVehicle(vehicle);
            }}
          />
        </div>

        {/* Save Route Dialog */}
        <SaveRouteDialog
          open={isSaveRouteDialogOpen}
          onOpenChange={setIsSaveRouteDialogOpen}
          waypoints={routeWaypoints}
          totalDistance={calculateRouteDistance()}
          estimatedDuration={calculateEstimatedDuration()}
        />
      </div>
    </TooltipProvider>
  );
};

export default UnifiedMapView;