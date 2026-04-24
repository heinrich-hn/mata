import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatLastConnected,
  type TelematicsAsset,
} from "@/lib/telematicsGuru";
import type { ActiveLoadForTracking } from "@/lib/api";
import { findDepotByName, customLocationToDepot } from "@/lib/depots";
import { calculateHaversineDistance } from "@/lib/waypoints";
import { parseTimeWindow } from "@/lib/timeWindow";
import type { CustomLocation } from "@/hooks/useCustomLocations";
import {
  Truck,
  User,
  CheckCircle2,
  Clock,
  Route as RouteIcon,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { cn } from "@/lib/utils";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadWithTimes {
  id: string;
  load_id: string;
  origin: string;
  destination: string;
  status: string;
  loading_date?: string;
  offloading_date?: string;
  time_window?: unknown;
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
  driver?: { id: string; name: string; contact?: string } | null;
  fleet_vehicle?: { id: string; vehicle_id: string; telematics_asset_id?: string | null } | null;
}

interface TripHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: TelematicsAsset | null;
  activeLoad?: ActiveLoadForTracking | null;
  vehicleLoads?: LoadWithTimes[];
  organisationId?: number | null;
  customLocations?: CustomLocation[];
}

type StopStatus = "completed" | "at-stop" | "en-route" | "scheduled";

interface TripStop {
  id: string;
  kind: "start" | "stop" | "end";
  index: number;
  name: string;
  status: StopStatus;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  arrivalSource?: string | null;
  departureSource?: string | null;
  arrivalVerified?: boolean;
  departureVerified?: boolean;
  dwellLabel?: string | null;
  varianceLabel?: string | null;
  isLate?: boolean;
  lat?: number | null;
  lng?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStopDateTime(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return format(new Date(iso), "MMM d, h:mm a");
  } catch {
    return null;
  }
}

function planTimeOnDate(time: string | undefined | null, date: string | undefined): Date | null {
  if (!time || !date) return null;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
    if (isNaN(hh)) return null;
    d.setHours(hh, mm || 0, 0, 0);
    return d;
  } catch {
    return null;
  }
}

function formatPlanned(time: string | undefined | null, date: string | undefined): string | null {
  const dt = planTimeOnDate(time, date);
  if (!dt) return null;
  return format(dt, "MMM d, h:mm a");
}

function computeVariance(plannedDate: Date | null, actualIso: string | null | undefined): { label: string; isLate: boolean } | null {
  if (!plannedDate || !actualIso) return null;
  try {
    const actual = new Date(actualIso);
    if (isNaN(actual.getTime())) return null;
    const diffMin = Math.round((actual.getTime() - plannedDate.getTime()) / 60000);
    if (diffMin === 0) return { label: "on time", isLate: false };
    const absMin = Math.abs(diffMin);
    const hr = Math.floor(absMin / 60);
    const min = absMin % 60;
    const human = hr > 0 ? `${hr}h ${min}m` : `${min}m`;
    return { label: diffMin > 0 ? `${human} late` : `${human} early`, isLate: diffMin > 5 };
  } catch {
    return null;
  }
}

function buildStops(load: LoadWithTimes, customLocations: CustomLocation[]): TripStop[] {
  const tw = parseTimeWindow(load.time_window);
  const extra = customLocations.map(customLocationToDepot);

  const originDepot = findDepotByName(load.origin || "", extra);
  const destDepot = findDepotByName(load.destination || "", extra);

  const stops: TripStop[] = [];

  // ---- START (origin / loading) ----
  const originPlannedArr = planTimeOnDate(tw.origin?.plannedArrival, load.loading_date);
  const originStatus: StopStatus = load.actual_loading_departure
    ? "completed"
    : load.actual_loading_arrival
      ? "at-stop"
      : load.status === "in-transit" || load.status === "delivered"
        ? "completed"
        : "scheduled";
  const originVar = computeVariance(originPlannedArr, load.actual_loading_arrival);
  const originDwell = load.actual_loading_arrival && load.actual_loading_departure
    ? formatDistanceStrict(new Date(load.actual_loading_arrival), new Date(load.actual_loading_departure))
    : null;

  stops.push({
    id: `${load.id}-start`,
    kind: "start",
    index: 0,
    name: load.origin || "Origin",
    status: originStatus,
    plannedArrival: tw.origin?.plannedArrival ? formatPlanned(tw.origin.plannedArrival, load.loading_date) : null,
    plannedDeparture: tw.origin?.plannedDeparture ? formatPlanned(tw.origin.plannedDeparture, load.loading_date) : null,
    actualArrival: formatStopDateTime(load.actual_loading_arrival),
    actualDeparture: formatStopDateTime(load.actual_loading_departure),
    arrivalSource: load.actual_loading_arrival_source ?? null,
    departureSource: load.actual_loading_departure_source ?? null,
    arrivalVerified: !!load.actual_loading_arrival_verified,
    departureVerified: !!load.actual_loading_departure_verified,
    dwellLabel: originDwell ? `${originDwell} at stop` : null,
    varianceLabel: originVar?.label ?? null,
    isLate: !!originVar?.isLate,
    lat: originDepot?.latitude ?? null,
    lng: originDepot?.longitude ?? null,
  });

  // ---- WAYPOINTS ----
  const waypoints = tw.waypoints ?? [];
  waypoints.forEach((wp, i) => {
    const wpDepot = findDepotByName(wp.placeName || "", extra);
    const wpStatus: StopStatus =
      load.status === "delivered"
        ? "completed"
        : load.actual_loading_departure
          ? "en-route"
          : "scheduled";
    stops.push({
      id: `${load.id}-wp-${i}`,
      kind: "stop",
      index: i + 1,
      name: wp.placeName || `Stop ${i + 1}`,
      status: wpStatus,
      plannedArrival: wp.plannedArrival ? formatPlanned(wp.plannedArrival, load.loading_date) : null,
      plannedDeparture: wp.plannedDeparture ? formatPlanned(wp.plannedDeparture, load.loading_date) : null,
      lat: wpDepot?.latitude ?? null,
      lng: wpDepot?.longitude ?? null,
    });
  });

  // ---- END (destination / offloading) ----
  const destPlannedArr = planTimeOnDate(tw.destination?.plannedArrival, load.offloading_date);
  const destStatus: StopStatus = load.actual_offloading_departure
    ? "completed"
    : load.actual_offloading_arrival
      ? "at-stop"
      : load.actual_loading_departure
        ? "en-route"
        : "scheduled";
  const destVar = computeVariance(destPlannedArr, load.actual_offloading_arrival);
  const destDwell = load.actual_offloading_arrival && load.actual_offloading_departure
    ? formatDistanceStrict(new Date(load.actual_offloading_arrival), new Date(load.actual_offloading_departure))
    : null;

  stops.push({
    id: `${load.id}-end`,
    kind: "end",
    index: waypoints.length + 1,
    name: load.destination || "Destination",
    status: destStatus,
    plannedArrival: tw.destination?.plannedArrival ? formatPlanned(tw.destination.plannedArrival, load.offloading_date) : null,
    plannedDeparture: tw.destination?.plannedDeparture ? formatPlanned(tw.destination.plannedDeparture, load.offloading_date) : null,
    actualArrival: formatStopDateTime(load.actual_offloading_arrival),
    actualDeparture: formatStopDateTime(load.actual_offloading_departure),
    arrivalSource: load.actual_offloading_arrival_source ?? null,
    departureSource: load.actual_offloading_departure_source ?? null,
    arrivalVerified: !!load.actual_offloading_arrival_verified,
    departureVerified: !!load.actual_offloading_departure_verified,
    dwellLabel: destDwell ? `${destDwell} at stop` : null,
    varianceLabel: destVar?.label ?? null,
    isLate: !!destVar?.isLate,
    lat: destDepot?.latitude ?? null,
    lng: destDepot?.longitude ?? null,
  });

  return stops;
}

// ---------------------------------------------------------------------------
// Map markers
// ---------------------------------------------------------------------------

function makeStopIcon(kind: "start" | "stop" | "end", index: number, status: StopStatus): L.DivIcon {
  if (kind === "stop") {
    const ringColor =
      status === "completed" ? "#10b981"
        : status === "at-stop" ? "#f59e0b"
          : status === "en-route" ? "#f59e0b"
            : "#94a3b8";
    return L.divIcon({
      html: `
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;border:3px solid ${ringColor};background:white;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;background:#0f172a;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;font-family:'Inter',system-ui,sans-serif;letter-spacing:-0.02em;">
            ${String(index).padStart(2, "0")}
          </div>
        </div>`,
      className: "trip-stop-marker",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
  const fill = "#0f172a";
  return L.divIcon({
    html: `
      <div style="position:relative;width:30px;height:38px;">
        <svg viewBox="0 0 30 38" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C7 0 0 6 0 14c0 10 15 24 15 24s15-14 15-24C30 6 23 0 15 0z" fill="${fill}"/>
          <circle cx="15" cy="14" r="6" fill="white"/>
          <circle cx="15" cy="14" r="3" fill="${fill}"/>
        </svg>
      </div>`,
    className: "trip-end-marker",
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}

function FitToStops({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

// ---------------------------------------------------------------------------
// Stop card
// ---------------------------------------------------------------------------

function statusBadgeProps(status: StopStatus): { label: string; cls: string } {
  switch (status) {
    case "completed":
      return { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "at-stop":
      return { label: "At Stop", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "en-route":
      return { label: "En Route", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "scheduled":
    default:
      return { label: "Scheduled", cls: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

function StopCard({ stop, isLast }: { stop: TripStop; isLast: boolean }) {
  const sb = statusBadgeProps(stop.status);
  const isStart = stop.kind === "start";
  const isEnd = stop.kind === "end";
  const showActual = !!(stop.actualArrival || stop.actualDeparture);

  const nodeBadge = isStart
    ? <span className="text-[10px] font-bold tracking-wider text-white bg-blue-600 rounded px-2 py-1">START</span>
    : isEnd
      ? <span className="text-[10px] font-bold tracking-wider text-white bg-slate-900 rounded px-2 py-1">END</span>
      : (
        <div className="flex flex-col items-center text-[10px] font-semibold text-slate-600 leading-tight">
          <span className="text-base font-bold text-slate-900 leading-none">{String(stop.index).padStart(2, "0")}</span>
          <span className="uppercase tracking-wide text-[9px] text-slate-500 mt-0.5">stop</span>
        </div>
      );

  const dotColor =
    stop.status === "completed" ? "bg-emerald-500 border-emerald-500"
      : stop.status === "at-stop" ? "bg-amber-400 border-amber-400"
        : stop.status === "en-route" ? "bg-amber-400 border-amber-400"
          : "bg-white border-slate-300";

  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center w-16 flex-shrink-0">
        <div className="h-7 flex items-center justify-center">{nodeBadge}</div>
        <div className={cn("w-3.5 h-3.5 rounded-full border-2 mt-1.5", dotColor)} />
        {!isLast && (
          <div className="flex-1 w-0.5 mt-1 mb-1 border-l-2 border-dashed border-slate-300 min-h-[40px]" />
        )}
      </div>

      <div className="flex-1 pb-4">
        <div className={cn(
          "rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm",
          stop.status === "completed" && "border-emerald-100",
          stop.status === "at-stop" && "border-amber-200",
        )}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", sb.cls)}>
              {sb.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {stop.name}
            </h4>
            {stop.varianceLabel && (
              <span className={cn(
                "text-[11px]",
                stop.isLate ? "text-rose-600 font-medium" : "text-emerald-600",
              )}>
                ({stop.varianceLabel})
              </span>
            )}
          </div>

          <div className="space-y-0.5 text-xs">
            {showActual ? (
              <>
                {stop.actualArrival && (
                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500">Arrived</span>
                    <span className="font-medium">{stop.actualArrival}</span>
                    {stop.arrivalSource === "auto" && <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />}
                  </div>
                )}
                {stop.actualDeparture && (
                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500">Departed</span>
                    <span className="font-medium">{stop.actualDeparture}</span>
                    {stop.departureSource === "auto" && <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />}
                  </div>
                )}
              </>
            ) : (
              <>
                {stop.plannedArrival && (
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="text-slate-500">Planned Arrival</span>{" "}
                    <span className="font-medium">{stop.plannedArrival}</span>
                  </div>
                )}
                {stop.plannedDeparture && (
                  <div className="text-slate-600 dark:text-slate-400">
                    <span className="text-slate-500">Planned Departure</span>{" "}
                    <span className="font-medium">{stop.plannedDeparture}</span>
                  </div>
                )}
                {!stop.plannedArrival && !stop.plannedDeparture && (
                  <div className="text-slate-400 italic">No times scheduled</div>
                )}
              </>
            )}
          </div>

          {stop.dwellLabel && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
              <Clock className="h-3 w-3" />
              <span>{stop.dwellLabel}</span>
            </div>
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
  customLocations = [],
}: TripHistoryDialogProps) {
  const sortedLoads = useMemo(() => {
    return [...vehicleLoads].sort((a, b) => {
      const aTime = a.actual_loading_arrival || a.loading_date || "";
      const bTime = b.actual_loading_arrival || b.loading_date || "";
      return bTime.localeCompare(aTime);
    });
  }, [vehicleLoads]);

  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  // Auto-select most recent active/in-transit load when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedLoadId(null);
      return;
    }
    if (sortedLoads.length === 0) return;
    setSelectedLoadId((current) => {
      if (current && sortedLoads.some((l) => l.id === current)) return current;
      const active = sortedLoads.find((l) => l.status === "in-transit" || l.status === "scheduled");
      return active?.id || sortedLoads[0].id;
    });
  }, [open, sortedLoads]);

  const selectedLoad = useMemo(
    () => sortedLoads.find((l) => l.id === selectedLoadId) ?? null,
    [sortedLoads, selectedLoadId],
  );

  // Past 3 completed trips (excluding the currently selected one)
  const recentCompleted = useMemo(
    () => sortedLoads
      .filter((l) => l.status === "delivered" && l.id !== selectedLoadId)
      .slice(0, 3),
    [sortedLoads, selectedLoadId],
  );

  const stops = useMemo(
    () => (selectedLoad ? buildStops(selectedLoad, customLocations) : []),
    [selectedLoad, customLocations],
  );

  const stopPoints = useMemo(
    () => stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat as number, s.lng as number] as [number, number]),
    [stops],
  );

  const allPoints = useMemo(() => {
    const pts = [...stopPoints];
    if (asset?.lastLatitude != null && asset?.lastLongitude != null) {
      pts.push([asset.lastLatitude, asset.lastLongitude]);
    }
    return pts;
  }, [stopPoints, asset]);

  const totalDistanceKm = useMemo(() => {
    if (stopPoints.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < stopPoints.length; i++) {
      d += calculateHaversineDistance(stopPoints[i - 1][0], stopPoints[i - 1][1], stopPoints[i][0], stopPoints[i][1]);
    }
    return d;
  }, [stopPoints]);

  const completedCount = stops.filter((s) => s.status === "completed").length;
  const totalCount = stops.length;

  const isLive = selectedLoad?.status === "in-transit";
  const driverName = selectedLoad?.driver?.name || "—";
  const vehicleReg = selectedLoad?.fleet_vehicle?.vehicle_id || asset?.name || asset?.code || `Vehicle ${asset?.id}`;

  const vehicleIcon = useMemo(() => {
    if (!isLive) return null;
    return L.divIcon({
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,0.25);animation:trip-pulse 2s infinite;"></div>
          <div style="position:relative;width:18px;height:18px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
        </div>
        <style>@keyframes trip-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.4}}</style>`,
      className: "trip-vehicle-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, [isLive]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">Trip History for {vehicleReg}</DialogTitle>
        <DialogDescription className="sr-only">
          Stop-by-stop trip timeline and route map for {vehicleReg}
        </DialogDescription>

        <div className="flex flex-1 min-h-0 bg-slate-50 dark:bg-slate-950">
          {/* LEFT PANEL */}
          <div className="w-[440px] flex-shrink-0 flex flex-col border-r bg-white dark:bg-slate-900">
            <div className="px-5 py-4 border-b bg-white dark:bg-slate-900">
              {sortedLoads.length === 0 ? (
                <>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Vehicle</div>
                  <div className="text-xl font-bold">{vehicleReg}</div>
                  <div className="text-xs text-slate-500 mt-0.5">No trip history yet</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-slate-500">Trip ID</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="text-2xl font-bold leading-none">{selectedLoad?.load_id ?? "—"}</div>
                    {isLive && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                        Live
                      </Badge>
                    )}
                    {!isLive && selectedLoad?.status === "delivered" && (
                      <Badge variant="outline" className="text-slate-600">Completed</Badge>
                    )}
                    {!isLive && selectedLoad?.status === "scheduled" && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Scheduled</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium truncate">{driverName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <RouteIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km route` : "— km"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Truck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium truncate">{vehicleReg}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{completedCount}/{totalCount} completed</span>
                    </div>
                  </div>

                  {asset && (
                    <div className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t flex items-center gap-2">
                      <span>{Math.round(asset.speedKmH)} km/h</span>
                      <span>·</span>
                      <span>{asset.inTrip ? "Moving" : "Parked"}</span>
                      <span>·</span>
                      <span>Last seen {formatLastConnected(asset.lastConnectedUtc)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {sortedLoads.length > 1 && (
              <div className="px-5 py-2.5 border-b bg-slate-50 dark:bg-slate-900/50">
                <Select value={selectedLoadId ?? undefined} onValueChange={setSelectedLoadId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select trip" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedLoads.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">
                        <span className="font-medium">{l.load_id}</span>
                        <span className="text-slate-500 ml-2">
                          {l.origin} → {l.destination}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="px-5 py-4">
                {!selectedLoad ? (
                  <div className="text-center py-12 text-slate-400">
                    <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No trips for this vehicle yet</p>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-3 px-2 py-1 inline-block rounded border bg-white">
                      Sort by Scheduled
                    </div>
                    <div>
                      {stops.map((stop, i) => (
                        <StopCard key={stop.id} stop={stop} isLast={i === stops.length - 1} />
                      ))}
                    </div>

                    {recentCompleted.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-2">
                          Recent Completed Trips
                        </div>
                        <div className="space-y-1.5">
                          {recentCompleted.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => setSelectedLoadId(l.id)}
                              className="w-full text-left px-3 py-2 rounded border bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold truncate">{l.load_id}</span>
                                <Badge variant="outline" className="text-[10px] py-0 h-4 text-slate-600">Completed</Badge>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {l.origin} → {l.destination}
                              </div>
                              {l.offloading_date && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Delivered {l.offloading_date}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT PANEL: MAP */}
          <div className="flex-1 relative bg-slate-100 dark:bg-slate-800">
            {allPoints.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <RouteIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Route map unavailable</p>
                  <p className="text-xs mt-1">Stop locations could not be resolved</p>
                </div>
              </div>
            ) : (
              <MapContainer
                key={selectedLoad?.id ?? "empty"}
                center={[allPoints[0][0], allPoints[0][1]]}
                zoom={10}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <FitToStops points={allPoints} />

                {stopPoints.length >= 2 && (
                  <Polyline
                    positions={stopPoints}
                    pathOptions={{
                      color: "#0f172a",
                      weight: 2,
                      opacity: 0.7,
                      dashArray: "8 8",
                    }}
                  />
                )}

                {stops.map((stop) => {
                  if (stop.lat == null || stop.lng == null) return null;
                  return (
                    <Marker
                      key={stop.id}
                      position={[stop.lat, stop.lng]}
                      icon={makeStopIcon(stop.kind, stop.index || 0, stop.status)}
                    />
                  );
                })}

                {isLive && vehicleIcon && asset?.lastLatitude != null && asset?.lastLongitude != null && (
                  <Marker
                    position={[asset.lastLatitude, asset.lastLongitude]}
                    icon={vehicleIcon}
                  />
                )}
              </MapContainer>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
