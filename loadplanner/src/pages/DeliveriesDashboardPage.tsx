import { StatusBadge } from "@/components/trips/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCustomLocations } from "@/hooks/useCustomLocations";
import { useDrivers } from "@/hooks/useDrivers";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useGeofenceMonitor } from "@/hooks/useGeofenceMonitor";
import { type Load, useLoads } from "@/hooks/useTrips";
import {
  calculateDepotETA,
  calculateDepotTripProgress,
  customLocationToDepot,
  findDepotByName,
} from "@/lib/depots";
import {
  formatLastConnected,
  type TelematicsAsset,
} from "@/lib/telematicsGuru";
import { parseTimeWindow } from "@/lib/timeWindow";
import { cn, getLocationDisplayName, safeFormatDate } from "@/lib/utils";
import { endOfWeek, format, formatDistanceToNow, parseISO, startOfWeek } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  Navigation,
  Package,
  Route,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Timer,
} from "lucide-react";
import { useMemo } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface LoadWithETA extends Load {
  telematicsAsset?: TelematicsAsset | null;
  lastUpdate?: string;
  progressData?: {
    progress: number;
    totalDistance: number;
    distanceTraveled: number;
    distanceRemaining: number;
    etaFormatted: string;
    durationFormatted: string;
    originName?: string;
    destinationName?: string;
    isAtOrigin?: boolean;
    isAtDestination?: boolean;
    nearestDepot?: string | null;
  } | null;
  truckPosition?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    lastUpdate: string;
    isMoving: boolean;
  } | null;
  isTrackingActive?: boolean;
  isAtLoadOrigin?: boolean;
}

interface TruckWithLoads {
  vehicleId: string;
  vehicleName: string;
  vehicleType?: string;
  vehicleMakeModel?: string;
  vehicleCapacity?: number;
  driverId?: string;
  driverName?: string;
  driverContact?: string;
  driverPhotoUrl?: string;
  telematicsAsset?: TelematicsAsset | null;
  loads: LoadWithETA[];
  currentLoad?: LoadWithETA;
  isMoving: boolean;
  lastUpdate?: string;
  lastUpdateDate?: Date;
  currentLocation?: string;
  speed?: number;
  gpsSignalStrength: "strong" | "medium" | "weak" | "none";
  totalLoadsToday: number;
  completedLoadsToday: number;
  isStale: boolean;
  staleMinutes?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getGpsSignalStrength(
  lastConnectedUtc?: string
): "strong" | "medium" | "weak" | "none" {
  if (!lastConnectedUtc) return "none";
  const now = new Date();
  const lastUpdate = new Date(lastConnectedUtc);
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
  if (diffMinutes < 5) return "strong";
  if (diffMinutes < 15) return "medium";
  if (diffMinutes < 60) return "weak";
  return "none";
}

function formatCargoType(cargoType: string): string {
  const map: Record<string, string> = {
    VanSalesRetail: "Van Sales",
    Retail: "Retail",
    Vendor: "Vendor",
    RetailVendor: "Retail/Vendor",
    Fertilizer: "Fertilizer",
    BV: "BV",
    CBC: "CBC",
    Packaging: "Packaging",
  };
  return map[cargoType] || cargoType;
}

function extractVehicleNumber(vehicleId: string): number {
  const match = vehicleId.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DeliveriesDashboardPage() {
  const { data: loads = [], isLoading: loadsLoading } = useLoads();
  const { data: fleetVehicles = [] } = useFleetVehicles();
  const { data: drivers = [] } = useDrivers();
  const { data: customLocations = [] } = useCustomLocations();

  // Convert custom locations to Depot shape so they work with distance calculations
  const extraDepots = useMemo(
    () => customLocations.map(customLocationToDepot),
    [customLocations]
  );

  // Use the global geofence monitor for telematics data and auto-capture
  const {
    telematicsAssets: _telematicsAssets,
    telematicsLoading: _telematicsLoading,
    telematicsAuthError,
    lastRefresh: _lastRefresh,
    loadsWithAssets,
    refetch: _refetch,
  } = useGeofenceMonitor();

  // Enrich loads with progress data and truck positions for the deliveries UI
  const loadsWithETA: LoadWithETA[] = useMemo(() => {
    // Build per-vehicle-origin current load map
    const loadsByVehicleOrigin = new Map<string, typeof loadsWithAssets>();
    for (const load of loadsWithAssets) {
      const vehicleId = load.fleet_vehicle?.vehicle_id || "unassigned";
      const originKey = `${vehicleId}::${load.origin}`;
      if (!loadsByVehicleOrigin.has(originKey)) {
        loadsByVehicleOrigin.set(originKey, []);
      }
      loadsByVehicleOrigin.get(originKey)!.push(load);
    }
    const currentLoadByVehicle = new Map<string, string>();
    for (const [originKey, vehicleLoads] of loadsByVehicleOrigin) {
      const sortedLoads = [...vehicleLoads].sort(
        (a, b) => parseISO(a.loading_date).getTime() - parseISO(b.loading_date).getTime()
      );
      const inTransitLoad = sortedLoads.find((l) => l.status === "in-transit");
      if (inTransitLoad) {
        currentLoadByVehicle.set(originKey, inTransitLoad.id);
      } else {
        const scheduledLoads = sortedLoads.filter((l) => l.status === "scheduled");
        if (scheduledLoads.length > 0) {
          currentLoadByVehicle.set(originKey, scheduledLoads[0].id);
        }
      }
    }

    return loadsWithAssets.map((load) => {
      const vehicleId = load.fleet_vehicle?.vehicle_id || "unassigned";
      const originKey = `${vehicleId}::${load.origin}`;
      const currentLoadId = currentLoadByVehicle.get(originKey);
      const isCurrentLoad = currentLoadId === load.id;
      const isInTransit = load.status === "in-transit";
      // Only the current load in sequence should be considered "at origin".
      // Other loads from the same origin must wait for earlier ones to complete.
      const effectiveIsAtLoadOrigin = isCurrentLoad && load.isAtLoadOrigin;
      const isTrackingActive = isInTransit || effectiveIsAtLoadOrigin;
      let progressData = null;
      let truckPosition = null;
      const originDepot = findDepotByName(load.origin, extraDepots);
      const destDepot = findDepotByName(load.destination, extraDepots);
      if (originDepot && destDepot) {
        const telematicsAsset = load.telematicsAsset;
        if (telematicsAsset?.lastLatitude && telematicsAsset?.lastLongitude) {
          truckPosition = {
            latitude: telematicsAsset.lastLatitude,
            longitude: telematicsAsset.lastLongitude,
            speed: telematicsAsset.speedKmH || 0,
            heading: telematicsAsset.heading || 0,
            lastUpdate: telematicsAsset.lastConnectedUtc
              ? formatLastConnected(telematicsAsset.lastConnectedUtc)
              : "Unknown",
            isMoving: telematicsAsset.speedKmH > 5,
          };
          if (isTrackingActive) {
            const tripProgress = calculateDepotTripProgress(
              originDepot,
              destDepot,
              telematicsAsset.lastLatitude,
              telematicsAsset.lastLongitude
            );
            const speed = telematicsAsset.speedKmH > 10 ? telematicsAsset.speedKmH : 60;
            const eta = calculateDepotETA(tripProgress.distanceRemaining, speed);
            progressData = {
              progress: tripProgress.progress,
              totalDistance: tripProgress.totalDistance,
              distanceTraveled: tripProgress.distanceTraveled,
              distanceRemaining: tripProgress.distanceRemaining,
              etaFormatted: eta.etaFormatted,
              durationFormatted: eta.durationFormatted,
              originName: originDepot.name,
              destinationName: destDepot.name,
              isAtOrigin: tripProgress.isAtOrigin,
              isAtDestination: tripProgress.isAtDestination,
              nearestDepot: tripProgress.nearestDepot?.name || null,
            };
          } else {
            const tripProgress = calculateDepotTripProgress(
              originDepot,
              destDepot,
              originDepot.latitude,
              originDepot.longitude
            );
            const eta = calculateDepotETA(tripProgress.totalDistance, 60);
            progressData = {
              progress: 0,
              totalDistance: tripProgress.totalDistance,
              distanceTraveled: 0,
              distanceRemaining: tripProgress.totalDistance,
              etaFormatted: "--:--",
              durationFormatted: eta.durationFormatted,
              originName: originDepot.name,
              destinationName: destDepot.name,
              isAtOrigin: false,
              isAtDestination: false,
              nearestDepot: null,
            };
          }
        }
      }
      return {
        ...load,
        isAtLoadOrigin: effectiveIsAtLoadOrigin,
        progressData,
        truckPosition,
        isTrackingActive,
      };
    });
  }, [loadsWithAssets, extraDepots]);

  const activeLoads = useMemo(() => {
    // Only include current week's loads (Mon-Sun) plus any in-transit loads
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    return [...loadsWithETA]
      .filter((l) => {
        // Always include in-transit loads regardless of date
        if (l.status === "in-transit") return true;
        const loadDate = parseISO(l.loading_date);
        return loadDate >= weekStart && loadDate <= weekEnd;
      })
      .sort((a, b) => {
        const dateA = parseISO(a.loading_date).getTime();
        const dateB = parseISO(b.loading_date).getTime();
        return dateA - dateB;
      });
  }, [loadsWithETA]);

  const trucksWithLoads: TruckWithLoads[] = useMemo(() => {
    const truckMap = new Map<string, TruckWithLoads>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLoads = loads.filter((l) => {
      const loadDate = parseISO(l.loading_date);
      loadDate.setHours(0, 0, 0, 0);
      return loadDate.getTime() === today.getTime();
    });

    for (const load of activeLoads) {
      const vehicleId = load.fleet_vehicle?.vehicle_id || "unassigned";
      const vehicleName = load.fleet_vehicle?.vehicle_id || "Unassigned";
      const vehicleDetails = fleetVehicles.find((v) => v.vehicle_id === vehicleId);
      const driverDetails = load.driver?.id ? drivers.find((d) => d.id === load.driver?.id) : null;

      if (!truckMap.has(vehicleId)) {
        const vehicleTodayLoads = todayLoads.filter((l) => l.fleet_vehicle?.vehicle_id === vehicleId);
        const completedToday = vehicleTodayLoads.filter((l) => l.status === "delivered").length;

        const lastConnectedUtc = load.telematicsAsset?.lastConnectedUtc;
        const staleMinutes = lastConnectedUtc
          ? Math.floor((new Date().getTime() - new Date(lastConnectedUtc).getTime()) / (1000 * 60))
          : undefined;
        const isStale = staleMinutes !== undefined && staleMinutes > 30;

        truckMap.set(vehicleId, {
          vehicleId,
          vehicleName,
          vehicleType: vehicleDetails?.type || load.fleet_vehicle?.type,
          vehicleMakeModel: vehicleDetails?.make_model || undefined,
          vehicleCapacity: vehicleDetails?.capacity,
          driverId: load.driver?.id,
          driverName: load.driver?.name,
          driverContact: load.driver?.contact,
          driverPhotoUrl: driverDetails?.photo_url || undefined,
          telematicsAsset: load.telematicsAsset,
          loads: [],
          isMoving: load.telematicsAsset?.speedKmH ? load.telematicsAsset.speedKmH > 5 : false,
          lastUpdate: load.lastUpdate,
          lastUpdateDate: load.telematicsAsset?.lastConnectedUtc
            ? new Date(load.telematicsAsset.lastConnectedUtc)
            : undefined,
          currentLocation: load.progressData?.nearestDepot || undefined,
          speed: load.telematicsAsset?.speedKmH,
          gpsSignalStrength: getGpsSignalStrength(load.telematicsAsset?.lastConnectedUtc),
          totalLoadsToday: vehicleTodayLoads.length,
          completedLoadsToday: completedToday,
          isStale,
          staleMinutes,
        });
      }

      const truck = truckMap.get(vehicleId)!;
      truck.loads.push(load);

      if (load.telematicsAsset) {
        truck.telematicsAsset = load.telematicsAsset;
        truck.isMoving = load.telematicsAsset.speedKmH > 5;
        truck.lastUpdate = load.lastUpdate;
        truck.speed = load.telematicsAsset.speedKmH;
        truck.gpsSignalStrength = getGpsSignalStrength(load.telematicsAsset.lastConnectedUtc);
        truck.lastUpdateDate = load.telematicsAsset.lastConnectedUtc
          ? new Date(load.telematicsAsset.lastConnectedUtc)
          : undefined;
        // Update stale status
        const staleMinutes = load.telematicsAsset.lastConnectedUtc
          ? Math.floor((new Date().getTime() - new Date(load.telematicsAsset.lastConnectedUtc).getTime()) / (1000 * 60))
          : undefined;
        truck.staleMinutes = staleMinutes;
        truck.isStale = staleMinutes !== undefined && staleMinutes > 30;
      }
    }

    for (const truck of truckMap.values()) {
      truck.loads.sort(
        (a, b) => parseISO(a.loading_date).getTime() - parseISO(b.loading_date).getTime()
      );
      truck.currentLoad = truck.loads.find((l) => l.status === "in-transit") || truck.loads[0];
    }

    return Array.from(truckMap.values()).sort((a, b) => {
      if (a.vehicleId === "unassigned") return 1;
      if (b.vehicleId === "unassigned") return -1;
      const aNum = extractVehicleNumber(a.vehicleId);
      const bNum = extractVehicleNumber(b.vehicleId);
      if (aNum !== bNum) return aNum - bNum;
      return a.vehicleId.localeCompare(b.vehicleId);
    });
  }, [activeLoads, fleetVehicles, drivers, loads]);

  if (loadsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {telematicsAuthError && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                GPS tracking unavailable. Please authenticate to enable live tracking.
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/tracking">Setup Tracking</a>
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="space-y-6">
          {trucksWithLoads.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Active Deliveries</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  All loads have been delivered or none are scheduled
                </p>
                <Button variant="outline" asChild>
                  <a href="/loads">View All Loads</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  Fleet Deliveries — {format(new Date(), "dd MMM yyyy")}
                </h2>
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full">
                  {trucksWithLoads.length} {trucksWithLoads.length === 1 ? "truck" : "trucks"}
                </Badge>
              </div>
              {trucksWithLoads.map((truck) => (
                <TruckRow key={truck.vehicleId} truck={truck} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// TRUCK ROW
// ============================================================================

function TruckRow({ truck }: { truck: TruckWithLoads }) {
  const hasInTransit = truck.loads.some((l) => l.status === "in-transit");
  const isAtOrigin = truck.loads.some((l) => l.isAtLoadOrigin && l.status === "scheduled");

  const GpsIcon = () => {
    switch (truck.gpsSignalStrength) {
      case "strong":
        return <SignalHigh className="h-4 w-4 text-emerald-500" />;
      case "medium":
        return <SignalMedium className="h-4 w-4 text-amber-500" />;
      case "weak":
        return <SignalLow className="h-4 w-4 text-red-500" />;
      default:
        return <Signal className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden",
        hasInTransit && "ring-2 ring-blue-500/50",
        isAtOrigin && !hasInTransit && "ring-2 ring-purple-500/50",
      )}
    >
      <div className="flex">
        {/* Truck Info */}
        <div
          className={cn(
            "w-60 flex-shrink-0 border-r",
            hasInTransit
              ? "bg-blue-50/50 dark:bg-blue-950/20"
              : isAtOrigin
                ? "bg-purple-50/50 dark:bg-purple-950/20"
                : "bg-muted/30"
          )}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger>
                    <GpsIcon />
                  </TooltipTrigger>
                  <TooltipContent>
                    GPS: {truck.gpsSignalStrength}
                    {truck.lastUpdateDate && (
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(truck.lastUpdateDate, { addSuffix: true })}
                      </div>
                    )}
                    {truck.isStale && (
                      <div className="text-xs text-red-500 mt-1">
                        ⚠️ Data is stale ({truck.staleMinutes}+ min old)
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
                {truck.isStale && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertCircle className="h-3 w-3" />
                    STALE
                  </Badge>
                )}
                {truck.isMoving && !truck.isStale && (
                  <Badge className="bg-emerald-500 text-white text-[10px]">
                    MOVING
                  </Badge>
                )}
              </div>
            </div>

            <div className="mb-3">
              <h3 className="font-bold text-foreground text-base">{truck.vehicleName}</h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {truck.driverName || "No Driver"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-background border flex items-center gap-2">
                <Navigation className={cn(
                  "h-3.5 w-3.5",
                  truck.isMoving && !truck.isStale ? "text-emerald-500" : truck.isStale ? "text-red-500" : "text-muted-foreground"
                )} />
                <span className="font-bold">{truck.speed || 0} km/h</span>
              </div>
              <div className="p-2 rounded-lg bg-background border flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-bold">
                  {truck.completedLoadsToday}/{truck.totalLoadsToday || truck.loads.length}
                </span>
              </div>
            </div>

            {truck.currentLocation && (
              <div className="mt-3 p-2 rounded-lg bg-background border flex items-center gap-2 text-xs">
                <MapPin className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                <span className="truncate font-medium">{truck.currentLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Loads */}
        <div className="flex-1 min-w-0">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
              <Route className="h-4 w-4 text-muted-foreground" />
              Delivery Sequence
            </div>
            <Badge variant="secondary" className="text-xs px-2.5 py-1 rounded-full">
              {truck.loads.length} {truck.loads.length === 1 ? "load" : "loads"}
            </Badge>
          </div>

          <ScrollArea className="w-full">
            <div className="flex p-4 gap-4">
              {truck.loads.map((load, loadIndex) => (
                <LoadCard
                  key={load.id}
                  load={load}
                  isCurrent={truck.currentLoad?.id === load.id}
                  sequenceNumber={loadIndex + 1}
                  isLast={loadIndex === truck.loads.length - 1}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// LOAD CARD
// ============================================================================

function LoadCard({
  load,
  isCurrent,
  sequenceNumber,
  isLast,
}: {
  load: LoadWithETA;
  isCurrent: boolean;
  sequenceNumber: number;
  isLast: boolean;
}) {
  const isInTransit = load.status === "in-transit";
  const isDelivered = load.status === "delivered";
  const isTracking = load.isTrackingActive;
  const isWaiting = !isTracking && load.status === "scheduled";

  // Determine detailed status based on geofence timestamps
  const hasArrivedAtLoading = !!load.actual_loading_arrival;
  const hasDepartedLoading = !!load.actual_loading_departure;
  const hasArrivedAtOffloading = !!load.actual_offloading_arrival;
  const hasDepartedOffloading = !!load.actual_offloading_departure;

  // Determine current phase
  const isAtLoadingPoint = hasArrivedAtLoading && !hasDepartedLoading;
  const isAtOffloadingPoint = hasArrivedAtOffloading && !hasDepartedOffloading;

  // Get display status
  const getDetailedStatus = () => {
    if (hasDepartedOffloading || isDelivered) return { label: "DELIVERED", color: "emerald", icon: CheckCircle2 };
    if (isAtOffloadingPoint) return { label: "AT DEPOT - OFFLOADING", color: "purple", icon: MapPin };
    if (hasArrivedAtOffloading) return { label: "OFFLOADING", color: "purple", icon: Package };
    if (isInTransit || hasDepartedLoading) return { label: "IN TRANSIT", color: "blue", icon: Route };
    if (isAtLoadingPoint) return { label: "AT LOADING POINT", color: "violet", icon: MapPin };
    if (hasArrivedAtLoading) return { label: "LOADING", color: "violet", icon: Package };
    if (load.isAtLoadOrigin) return { label: "AT DEPOT", color: "purple", icon: MapPin };
    return { label: "SCHEDULED", color: "amber", icon: Calendar };
  };

  const detailedStatus = getDetailedStatus();
  const StatusIcon = detailedStatus.icon;

  // Parse planned times from time_window
  const tw = parseTimeWindow(load.time_window);

  // Compute variance between planned and actual times
  const computeCardVariance = (planned: string | undefined, actual: string | null | undefined) => {
    if (!planned || !actual) return null;
    const toMin = (t: string) => {
      const hm = t.match(/^(\d{1,2}):(\d{2})$/);
      if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
      const iso = t.match(/T(\d{2}):(\d{2})/);
      if (iso) return parseInt(iso[1], 10) * 60 + parseInt(iso[2], 10);
      return null;
    };
    const pMin = toMin(planned);
    const aMin = toMin(actual);
    if (pMin === null || aMin === null) return null;
    const diff = aMin - pMin;
    if (diff <= 0) return null; // Only flag late times
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const parts: string[] = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    return parts.join(" ") + " late";
  };

  const lateLoadingArrival = computeCardVariance(tw.origin.plannedArrival, load.actual_loading_arrival);
  const lateLoadingDeparture = computeCardVariance(tw.origin.plannedDeparture, load.actual_loading_departure);
  const lateOffloadingArrival = computeCardVariance(tw.destination.plannedArrival, load.actual_offloading_arrival);
  const lateOffloadingDeparture = computeCardVariance(tw.destination.plannedDeparture, load.actual_offloading_departure);
  const hasAnyLateTime = !!(lateLoadingArrival || lateLoadingDeparture || lateOffloadingArrival || lateOffloadingDeparture);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return format(date, "dd MMM HH:mm");
    } catch {
      return null;
    }
  };

  return (
    <div className="relative flex items-center">
      {/* Arrow connector to next card */}
      {!isLast && (
        <div className="absolute -right-5 top-1/2 -translate-y-1/2 flex items-center z-10">
          <div className={cn(
            "w-5 h-0.5 rounded-full",
            isDelivered ? "bg-emerald-400" : isInTransit ? "bg-blue-400" : "bg-muted"
          )} />
          <ChevronRight className={cn(
            "h-4 w-4 -ml-1.5",
            isDelivered ? "text-emerald-500" : isInTransit ? "text-blue-500" : "text-muted-foreground"
          )} />
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              "w-[340px] flex-shrink-0 cursor-pointer transition-all hover:shadow-md",
              isCurrent && isInTransit && "ring-2 ring-blue-500/50",
              isCurrent && !isInTransit && load.isAtLoadOrigin && "ring-2 ring-purple-500/50",
              isDelivered && "ring-2 ring-emerald-500/50",
            )}
          >
            <div
              className={cn(
                "h-1 w-full rounded-t-lg",
                hasAnyLateTime && "bg-red-500",
                !hasAnyLateTime && isDelivered && "bg-emerald-500",
                !hasAnyLateTime && isInTransit && !isDelivered && "bg-blue-500",
                !hasAnyLateTime && isAtLoadingPoint && "bg-violet-500",
                !hasAnyLateTime && isAtOffloadingPoint && !isDelivered && "bg-purple-500",
                !hasAnyLateTime && load.isAtLoadOrigin && !isInTransit && !isDelivered && !isAtLoadingPoint && "bg-purple-500",
                !hasAnyLateTime && isWaiting && !isDelivered && "bg-amber-500"
              )}
            />

            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                      isDelivered && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                      isInTransit && !isDelivered && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                      isAtLoadingPoint && "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                      isAtOffloadingPoint && !isDelivered && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                      load.isAtLoadOrigin && !isInTransit && !isDelivered && !isAtLoadingPoint && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                      isWaiting && !isDelivered && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    )}
                  >
                    {isDelivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : sequenceNumber}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 flex-shrink-0">
                    {load.load_id}
                  </Badge>
                  {load.cargo_type && (
                    <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {formatCargoType(load.cargo_type)}
                    </span>
                  )}
                  {load.weight > 0 && (
                    <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 flex-shrink-0">
                      {load.weight}T
                    </span>
                  )}
                </div>
                <Badge className={cn(
                  "text-[9px] gap-1 px-2 py-0.5 rounded-full flex-shrink-0 ml-1.5",
                  detailedStatus.color === "emerald" && "bg-emerald-500 text-white",
                  detailedStatus.color === "blue" && "bg-blue-500 text-white",
                  detailedStatus.color === "purple" && "bg-purple-500 text-white",
                  detailedStatus.color === "violet" && "bg-violet-500 text-white",
                  detailedStatus.color === "amber" && "bg-amber-500 text-white"
                )}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {detailedStatus.label}
                </Badge>
              </div>

              <div className="bg-muted/30 rounded-lg px-2.5 py-2 mb-2 border">
                <div className="flex items-start gap-1.5">
                  {/* Origin */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        hasArrivedAtLoading ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )} />
                      <p className="text-[10px] text-muted-foreground font-medium leading-none">FROM</p>
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate ml-4">
                      {getLocationDisplayName(load.origin)}
                    </p>
                    {hasArrivedAtLoading && (
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium ml-4 mt-0.5 truncate">
                        {formatTimestamp(load.actual_loading_arrival)}
                        {hasDepartedLoading && ` → ${formatTimestamp(load.actual_loading_departure)}`}
                      </p>
                    )}
                    {(lateLoadingArrival || lateLoadingDeparture) && (
                      <div className="flex items-center gap-1 ml-4 mt-0.5">
                        <AlertTriangle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />
                        <span className="text-[9px] text-red-600 dark:text-red-400 font-medium truncate">
                          {lateLoadingArrival || lateLoadingDeparture}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Arrow */}
                  <div className="flex items-center flex-shrink-0 mt-2.5">
                    <div className={cn(
                      "w-4 h-px",
                      isDelivered ? "bg-emerald-400" : hasDepartedLoading ? "bg-blue-400" : "bg-muted-foreground/20"
                    )} />
                    <ChevronRight className={cn(
                      "h-3 w-3 -ml-1",
                      isDelivered ? "text-emerald-500" : hasDepartedLoading ? "text-blue-500" : "text-muted-foreground/40"
                    )} />
                  </div>
                  {/* Destination */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        isDelivered ? "bg-emerald-500" : hasArrivedAtOffloading ? "bg-purple-500" : "bg-muted-foreground/30"
                      )} />
                      <p className="text-[10px] text-muted-foreground font-medium leading-none">TO</p>
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate ml-4">
                      {getLocationDisplayName(load.destination)}
                    </p>
                    {hasArrivedAtOffloading && (
                      <p className="text-[9px] text-purple-600 dark:text-purple-400 font-medium ml-4 mt-0.5 truncate">
                        {formatTimestamp(load.actual_offloading_arrival)}
                        {hasDepartedOffloading && ` → ${formatTimestamp(load.actual_offloading_departure)}`}
                      </p>
                    )}
                    {(lateOffloadingArrival || lateOffloadingDeparture) && (
                      <div className="flex items-center gap-1 ml-4 mt-0.5">
                        <AlertTriangle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />
                        <span className="text-[9px] text-red-600 dark:text-red-400 font-medium truncate">
                          {lateOffloadingArrival || lateOffloadingDeparture}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Distance */}
                  <div className="text-right flex-shrink-0 pl-1">
                    <p className="text-base font-bold text-foreground leading-tight">
                      {load.progressData ? Math.round(load.progressData.totalDistance) : "?"}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-medium">km</p>
                  </div>
                </div>
              </div>

              {load.progressData && (
                <div className="mb-2">
                  {isDelivered ? (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Delivered
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                      </div>
                      <Progress value={100} className="h-1.5" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>{Math.round(load.progressData.totalDistance)} km total</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Complete</span>
                      </div>
                    </>
                  ) : isAtOffloadingPoint ? (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
                          <MapPin className="h-3 w-3" />
                          At Depot - Offloading
                        </span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">100%</span>
                      </div>
                      <Progress value={100} className="h-1.5" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>Awaiting departure</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">📦 Offloading</span>
                      </div>
                    </>
                  ) : isTracking ? (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground font-medium">Progress</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {Math.round(load.progressData.progress)}%
                        </span>
                      </div>
                      <Progress value={load.progressData.progress} className="h-1.5" />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>{Math.round(load.progressData.distanceTraveled)} km done</span>
                        <span>{Math.round(load.progressData.distanceRemaining)} km left</span>
                      </div>
                    </>
                  ) : isAtLoadingPoint ? (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1 font-medium">
                          <Package className="h-3 w-3" />
                          At Loading Point
                        </span>
                        <span className="text-muted-foreground">0%</span>
                      </div>
                      <Progress value={0} className="h-1.5" />
                    </>
                  ) : load.isAtLoadOrigin ? (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
                          <MapPin className="h-3 w-3" />
                          At Depot - Loading
                        </span>
                        <span className="text-muted-foreground">0%</span>
                      </div>
                      <Progress value={0} className="h-1.5" />
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3" />
                          Scheduled
                        </span>
                        <span className="text-muted-foreground">0%</span>
                      </div>
                      <Progress value={0} className="h-1.5" />
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-2 border-t">
                {isDelivered ? (
                  <>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Delivered</span>
                    </div>
                    <span className="text-muted-foreground font-medium">
                      {load.actual_offloading_departure
                        ? formatTimestamp(load.actual_offloading_departure)
                        : safeFormatDate(load.loading_date, "dd MMM")}
                    </span>
                  </>
                ) : isTracking ? (
                  <>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Timer className="h-3.5 w-3.5" />
                      <span>ETA: {load.progressData?.etaFormatted || "N/A"}</span>
                    </div>
                    <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded-full text-[10px] font-semibold">{load.progressData?.durationFormatted}</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">{safeFormatDate(load.loading_date, "dd MMM")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold text-[10px] text-muted-foreground">{safeFormatDate(load.loading_date, "HH:mm")}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="max-w-sm p-0 overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-bold text-foreground">Load {load.load_id}</span>
                <div className="mt-0.5">
                  <StatusBadge
                    status={load.status}
                    distanceRemaining={load.progressData?.distanceRemaining}
                    hasArrivalTime={!!load.actual_offloading_arrival}
                    hasDepartureTime={!!load.actual_offloading_departure}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Origin</span>
              <span className="font-medium text-foreground">{load.origin}</span>
              <span className="text-muted-foreground">Destination</span>
              <span className="font-medium text-foreground">{load.destination}</span>
              {load.cargo_type && (
                <>
                  <span className="text-muted-foreground">Cargo</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">{formatCargoType(load.cargo_type)}</span>
                </>
              )}
              {load.weight > 0 && (
                <>
                  <span className="text-muted-foreground">Weight</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">{load.weight} tons</span>
                </>
              )}
              <span className="text-muted-foreground">Loading</span>
              <span className="font-medium text-foreground">
                {safeFormatDate(load.loading_date, "dd MMM HH:mm")}
              </span>
            </div>
            {isTracking && load.progressData && (
              <>
                <div className="h-px bg-border my-2" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(load.progressData.progress)}%
                  </span>
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium text-foreground">
                    {Math.round(load.progressData.distanceRemaining)} km
                  </span>
                  <span className="text-muted-foreground">ETA</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {load.progressData.etaFormatted}
                  </span>
                </div>
              </>
            )}
            {!isTracking && (
              <div className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2 pt-3 mt-2 border-t bg-amber-50/50 dark:bg-amber-900/10 -mx-4 px-4 py-2 -mb-4">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Tracking starts when truck arrives at {load.origin}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}