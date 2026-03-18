// src/components/loads/LoadUpdateTimeline.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLoadRealtimeContext } from "@/hooks/useLoadRealtimeContext";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Pause,
  Play,
  RotateCcw,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons (safe cast)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LoadUpdateTimelineProps {
  loadId: string;
}

/* ---------- Strongly typed realtime update ---------- */
type SupabaseEventType = "INSERT" | "UPDATE" | "DELETE";

interface RawRealtimeUpdate {
  eventType: unknown;
  data: Record<string, unknown>;
  timestamp: string | number | Date;
}

interface LoadUpdate {
  eventType: SupabaseEventType;
  data: Record<string, unknown>;
  timestamp: string | number | Date;
}

/* ---------- Track point for playback ---------- */
interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;
  course?: number;
}

/* ---------- Helper type guards ---------- */
const isNumberLike = (value: unknown): value is string | number =>
  typeof value === "string" || typeof value === "number";

const isSupabaseEvent = (value: unknown): value is SupabaseEventType =>
  value === "INSERT" || value === "UPDATE" || value === "DELETE";

/* ---------- Icon & description logic ---------- */
const getUpdateIcon = (update: LoadUpdate) => {
  const { data } = update;
  const status = data.status as string | undefined;

  if (status === "In Transit") return <Truck className="h-4 w-4 text-blue-600" />;
  if (status === "Delivered") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (data.current_latitude) return <MapPin className="h-4 w-4 text-purple-600" />;
  if (data.assigned_vehicle_id) return <Package className="h-4 w-4 text-orange-600" />;
  return <Clock className="h-4 w-4 text-gray-600" />;
};

const getUpdateDescription = (update: LoadUpdate) => {
  const { eventType, data } = update;

  if (eventType === "INSERT") return "Load created";
  if (eventType === "DELETE") return "Load deleted";

  const parts: string[] = [];

  if (data.status) parts.push(`Status: ${String(data.status)}`);
  if (data.assigned_vehicle_id) parts.push("Vehicle assigned");

  if (data.current_latitude && data.current_longitude) {
    const lat = isNumberLike(data.current_latitude) ? Number(data.current_latitude) : NaN;
    const lng = isNumberLike(data.current_longitude) ? Number(data.current_longitude) : NaN;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      parts.push(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  }

  if (data.total_km_traveled && isNumberLike(data.total_km_traveled)) {
    parts.push(`Distance: ${Number(data.total_km_traveled).toFixed(1)} km`);
  }

  if (data.current_speed_kmh && isNumberLike(data.current_speed_kmh)) {
    parts.push(`Speed: ${Number(data.current_speed_kmh).toFixed(0)} km/h`);
  }

  return parts.length ? parts.join(" · ") : "Updated";
};

/* ---------- Main component ---------- */
export const LoadUpdateTimeline = ({ loadId }: LoadUpdateTimelineProps) => {
  const { getLoadUpdates } = useLoadRealtimeContext();

  // Strongly-typed updates
  const raw = getLoadUpdates(loadId) as RawRealtimeUpdate[];
  const updates: LoadUpdate[] = raw.map((u) => ({
    ...u,
    eventType: isSupabaseEvent(u.eventType) ? u.eventType : "UPDATE",
  }));

  // Extract GPS points for playback
  const trackPoints: TrackPoint[] = updates
    .filter((u) => u.data.current_latitude && u.data.current_longitude)
    .map((u) => ({
      lat: Number(u.data.current_latitude),
      lng: Number(u.data.current_longitude),
      timestamp: new Date(u.timestamp),
      speed: isNumberLike(u.data.current_speed_kmh)
        ? Number(u.data.current_speed_kmh)
        : undefined,
      course: isNumberLike(u.data.course) ? Number(u.data.course) : undefined,
    }))
    .reverse(); // oldest first

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const currentIndexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const playbackPosRef = useRef<[number, number] | null>(null);

  const startPlayback = useCallback(() => {
    if (trackPoints.length < 2) return;
    setIsPlaying(true);
    currentIndexRef.current = 0;
    setPlaybackProgress(0);
    playbackPosRef.current = [trackPoints[0].lat, trackPoints[0].lng];

    const stepMs = Math.max(100, 1000 / playbackSpeed);

    intervalRef.current = setInterval(() => {
      currentIndexRef.current += 1;
      if (currentIndexRef.current >= trackPoints.length) {
        setIsPlaying(false);
        clearInterval(intervalRef.current!);
        return;
      }
      const pt = trackPoints[currentIndexRef.current];
      playbackPosRef.current = [pt.lat, pt.lng];
      setPlaybackProgress(
        (currentIndexRef.current / (trackPoints.length - 1)) * 100
      );
    }, stepMs);
  }, [playbackSpeed, trackPoints]);

  const stopPlayback = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPlaying(false);
  };

  const resetPlayback = () => {
    stopPlayback();
    currentIndexRef.current = 0;
    setPlaybackProgress(0);
    if (trackPoints.length > 0) {
      playbackPosRef.current = [trackPoints[0].lat, trackPoints[0].lng];
    }
  };

  // Cleanup
  useEffect(() => () => stopPlayback(), []);

  // Speed change → restart
  useEffect(() => {
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }, [playbackSpeed, isPlaying, startPlayback]);

  // Map helpers
  const bounds = trackPoints.length
    ? L.latLngBounds(trackPoints.map((p) => [p.lat, p.lng]))
    : undefined;
  const center: [number, number] = trackPoints.length
    ? [trackPoints[0].lat, trackPoints[0].lng]
    : [-26.2041, 28.0473];

  const vehicleIcon = L.divIcon({
    className: "playback-vehicle",
    html: `<div style="transform: rotate(${
      trackPoints[currentIndexRef.current]?.course ?? 0
    }deg)">Truck</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent updates</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Recent Updates</CardTitle>
          <Badge variant="outline">{updates.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timeline */}
        <div className="space-y-3">
          {updates.map((update, idx) => (
            <div
              key={idx}
              className={`flex gap-3 pb-3 border-b last:border-0 last:pb-0 transition-all ${
                isPlaying && idx === updates.length - 1 - currentIndexRef.current
                  ? "bg-blue-50 rounded-lg -mx-2 px-2 py-1"
                  : ""
              }`}
            >
              <div className="mt-1">{getUpdateIcon(update)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {getUpdateDescription(update)}
                  </p>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {update.eventType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(update.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Playback map (only when we have GPS data) */}
        {trackPoints.length > 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Historical Track Playback</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={resetPlayback}
                  disabled={!isPlaying && currentIndexRef.current === 0}
                  className="h-6 w-6"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant={isPlaying ? "default" : "ghost"}
                  onClick={() => (isPlaying ? stopPlayback() : startPlayback())}
                  className="h-6 w-6"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Select
                  value={playbackSpeed.toString()}
                  onValueChange={(v) => setPlaybackSpeed(Number(v))}
                >
                  <SelectTrigger className="w-16 h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="5">5x</SelectItem>
                    <SelectItem value="10">10x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Progress value={playbackProgress} className="h-2" />

            <div className="h-64 rounded-lg overflow-hidden border">
              <MapContainer center={center} zoom={10} bounds={bounds} style={{ height: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />

                {/* Full track */}
                <Polyline
                  positions={trackPoints.map((p) => [p.lat, p.lng])}
                  color="#3b82f6"
                  weight={3}
                  opacity={0.6}
                />

                {/* Playback marker */}
                {playbackPosRef.current && (
                  <Marker position={playbackPosRef.current} icon={vehicleIcon}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold">Playback Position</p>
                        {trackPoints[currentIndexRef.current] && (
                          <>
                            <p>
                              Speed:{" "}
                              {trackPoints[currentIndexRef.current].speed?.toFixed(0) ?? 0} km/h
                            </p>
                            <p>
                              Time:{" "}
                              {trackPoints[currentIndexRef.current].timestamp.toLocaleString()}
                            </p>
                          </>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {trackPoints.length} GPS points •{" "}
              {trackPoints[trackPoints.length - 1].timestamp.toLocaleDateString()} →{" "}
              {trackPoints[0].timestamp.toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
