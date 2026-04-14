// ClientDeliveriesPage.tsx — Consolidated delivery tracking & load history
import { FeedbackWidget } from '@/components/clients/FeedbackWidget';
import { StatusBadge } from '@/components/trips/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClientFeedback } from '@/hooks/useClientFeedback';
import { useClientFeedback } from '@/hooks/useClientFeedback';
import { useClientActiveLoads, useClientLoads } from '@/hooks/useClientLoads';
import { useCustomLocations } from '@/hooks/useCustomLocations';
import type { Load } from '@/hooks/useTrips';
import {
  calculateDepotETA,
  calculateDepotTripProgress,
  customLocationToDepot,
  findDepotByName,
  isWithinDepot,
} from '@/lib/depots';
import {
  authenticate,
  getAssetsWithPositions,
  getOrganisations,
  isAuthenticated,
  type TelematicsAsset,
} from '@/lib/telematicsGuru';
import { parseTimeWindow, timeToSASTMinutes } from '@/lib/timeWindow';
import { cn, getLocationDisplayName, safeFormatDate } from '@/lib/utils';
import { parseISO } from 'date-fns';
import {
  ArrowRight,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Gauge,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/* ——— Types ——— */

interface LoadWithETA extends Load {
  telematicsAsset?: TelematicsAsset | null;
  progressData?: {
    progress: number;
    totalDistance: number;
    distanceRemaining: number;
    etaFormatted: string;
    durationFormatted: string;
    isAtOrigin?: boolean;
    isAtDestination?: boolean;
  } | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return safeFormatDate(value, 'dd MMM HH:mm', '—');
}

/**
 * Calculate variance between actual and planned times
 * @param actual - Actual timestamp
 * @param planned - Planned timestamp
 * @param eventType - What kind of event this is
 * @returns Object with label and className for styling
 */
function getVarianceLabel(
  actual?: string | null,
  planned?: string | null,
  eventType: 'loading_arrival' | 'loading_departure' | 'offloading_arrival' | 'offloading_departure' = 'loading_arrival'
) {
  if (!actual || !planned) return { label: '—', className: 'text-muted-foreground' };

  const plannedMins = timeToSASTMinutes(planned);
  const actualMins = timeToSASTMinutes(actual);
  if (plannedMins === null || actualMins === null) {
    return { label: '—', className: 'text-muted-foreground' };
  }

  const diffMins = actualMins - plannedMins;
  const absMins = Math.abs(diffMins);

  // Business logic:
  // - For arrivals (loading_arrival, offloading_arrival): 
  //   Early is good (can start early), Late is bad (delayed)
  // - For departures (loading_departure, offloading_departure):
  //   Early is bad (left before ready), Late is also bad (delayed departure)

  // Arrival events
  if (eventType === 'loading_arrival' || eventType === 'offloading_arrival') {
    if (absMins <= 10) {
      return { label: 'On time', className: 'text-success' };
    }

    if (absMins >= 60) {
      const hours = (absMins / 60).toFixed(absMins % 60 === 0 ? 0 : 1);
      return diffMins > 0
        ? { label: `+${hours}h late`, className: 'text-destructive' }
        : { label: `-${hours}h early`, className: 'text-success' };
    }

    return diffMins > 0
      ? { label: `+${absMins}m late`, className: 'text-destructive' }
      : { label: `-${absMins}m early`, className: 'text-success' };
  }

  // Departure events - both early and late are problematic
  if (eventType === 'loading_departure' || eventType === 'offloading_departure') {
    if (absMins <= 10) {
      return { label: 'On time', className: 'text-success' };
    }

    if (absMins >= 60) {
      const hours = (absMins / 60).toFixed(absMins % 60 === 0 ? 0 : 1);
      return {
        label: `${diffMins > 0 ? '+' : '-'}${hours}h`,
        className: 'text-warning'
      };
    }

    return {
      label: `${diffMins > 0 ? '+' : '-'}${absMins}m`,
      className: 'text-warning'
    };
  }

  return { label: '—', className: 'text-muted-foreground' };
}

/* ——— Main Component ——— */

export default function ClientDeliveriesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: activeLoads = [], isLoading: activeLoading } = useClientActiveLoads(clientId);
  const { data: allLoads = [], isLoading: allLoading } = useClientLoads(clientId);
  const { data: customLocations = [] } = useCustomLocations();
  const { data: feedbackList = [] } = useClientFeedback(clientId);

  const feedbackByLoadId = useMemo(() => {
    const map = new Map<string, typeof feedbackList[number]>();
    for (const fb of feedbackList) {
      map.set(fb.load_id, fb);
    }
    return map;
  }, [feedbackList]);

  const extraDepots = useMemo(() => customLocations.map(customLocationToDepot), [customLocations]);

  const [telematicsAssets, setTelematicsAssets] = useState<TelematicsAsset[]>([]);
  const [lastTelematicsUpdate, setLastTelematicsUpdate] = useState<Date | null>(null);
  const [organisationId, setOrganisationId] = useState<number | null>(() => {
    const stored = localStorage.getItem('telematics_org_id');
    return stored ? parseInt(stored) : null;
  });

  const fetchTelematicsData = useCallback(async () => {
    if (!isAuthenticated()) {
      const username = localStorage.getItem('telematics_username');
      const password = localStorage.getItem('telematics_password');
      if (username && password) {
        const success = await authenticate(username, password);
        if (!success) return;
      } else {
        return;
      }
    }

    try {
      let orgId = organisationId;
      if (!orgId) {
        const orgs = await getOrganisations();
        if (orgs?.length) {
          orgId = orgs[0].id;
          setOrganisationId(orgId);
          localStorage.setItem('telematics_org_id', orgId.toString());
        } else {
          return;
        }
      }

      const assets = await getAssetsWithPositions(orgId);
      setTelematicsAssets(assets || []);
      setLastTelematicsUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch telematics data:', error);
    }
  }, [organisationId]);

  useEffect(() => {
    fetchTelematicsData();
    const interval = setInterval(fetchTelematicsData, 30000);
    return () => clearInterval(interval);
  }, [fetchTelematicsData]);

  const loadsWithETA: LoadWithETA[] = useMemo(() => {
    const statusPriority: Record<string, number> = { 'in-transit': 0, 'scheduled': 1, 'pending': 2 };
    const currentLoadPerVehicle = new Map<string, string>();
    const vehicleGroups = new Map<string, typeof activeLoads>();

    for (const load of activeLoads) {
      const vid = load.fleet_vehicle?.vehicle_id;
      if (!vid) continue;
      if (!vehicleGroups.has(vid)) vehicleGroups.set(vid, []);
      vehicleGroups.get(vid)!.push(load);
    }

    for (const [vid, vLoads] of vehicleGroups) {
      const sorted = [...vLoads].sort((a, b) => {
        const sp = (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
        if (sp !== 0) return sp;
        const offDiff = new Date(a.offloading_date).getTime() - new Date(b.offloading_date).getTime();
        if (offDiff !== 0) return offDiff;
        return new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime();
      });
      if (sorted[0]) currentLoadPerVehicle.set(vid, sorted[0].id);
    }

    return activeLoads.map((load) => {
      const vehicleId = load.fleet_vehicle?.telematics_asset_id;
      const asset = vehicleId
        ? telematicsAssets.find((a) => a.id.toString() === vehicleId || a.code === vehicleId)
        : null;

      const isCurrentLoad = load.fleet_vehicle?.vehicle_id
        ? currentLoadPerVehicle.get(load.fleet_vehicle.vehicle_id) === load.id
        : true;

      let progressData = null;
      if (asset?.lastLatitude && asset.lastLongitude) {
        const originName = getLocationDisplayName(load.origin);
        const destName = getLocationDisplayName(load.destination);
        const originDepot = findDepotByName(originName, extraDepots);
        const destDepot = findDepotByName(destName, extraDepots);

        if (originDepot && destDepot) {
          const tripProgress = calculateDepotTripProgress(
            originDepot,
            destDepot,
            asset.lastLatitude,
            asset.lastLongitude
          );

          const eta = calculateDepotETA(tripProgress.distanceRemaining, asset.speedKmH || 60);

          progressData = {
            progress: tripProgress.progress,
            totalDistance: tripProgress.totalDistance,
            distanceRemaining: tripProgress.distanceRemaining,
            etaFormatted: eta?.etaFormatted || 'N/A',
            durationFormatted: eta?.durationFormatted || 'N/A',
            isAtOrigin: isCurrentLoad && isWithinDepot(asset.lastLatitude, asset.lastLongitude, originDepot),
            isAtDestination: isCurrentLoad && isWithinDepot(asset.lastLatitude, asset.lastLongitude, destDepot),
          };
        }
      }

      return { ...load, telematicsAsset: asset, progressData };
    });
  }, [activeLoads, telematicsAssets, extraDepots]);

  // ── Loads table filtering (merged from Loads tab) ──
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const statusFilter = (searchParams.get('status') || 'all') as 'all' | 'scheduled' | 'in-transit' | 'delivered' | 'pending';
  const dateFilter = (searchParams.get('date') || 'all') as 'all' | 'today' | 'week' | 'month';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const ITEMS_PER_PAGE = 20;

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value === 'all' || (key === 'page' && value === '1')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const filteredLoads = useMemo(() => {
    let result = [...allLoads];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((load) => {
        const origin = getLocationDisplayName(load.origin).toLowerCase();
        const destination = getLocationDisplayName(load.destination).toLowerCase();
        return (
          load.load_id.toLowerCase().includes(query) ||
          origin.includes(query) ||
          destination.includes(query) ||
          load.fleet_vehicle?.vehicle_id?.toLowerCase().includes(query) ||
          load.driver?.name?.toLowerCase().includes(query)
        );
      });
    }
    if (statusFilter !== 'all') {
      result = result.filter((load) => load.status === statusFilter);
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter((load) => {
        try {
          const loadDate = parseISO(load.loading_date);
          if (dateFilter === 'today') return loadDate >= today;
          if (dateFilter === 'week') return loadDate >= weekAgo;
          if (dateFilter === 'month') return loadDate >= monthAgo;
        } catch { return false; }
        return true;
      });
    }
    return result;
  }, [allLoads, searchQuery, statusFilter, dateFilter]);

  const clearFilters = () => { setSearchParams({}); };
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter !== 'all';

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayDeliveries = allLoads.filter(
      (l) => l.status === 'delivered' && new Date(l.offloading_date) >= startOfDay
    );

    const deliveredWithActual = allLoads.filter((l) => l.status === 'delivered' && l.actual_offloading_arrival);

    const avgDeliveryTimeMs =
      deliveredWithActual.length > 0
        ? deliveredWithActual.reduce((acc, l) => {
          const loading = new Date(l.loading_date).getTime();
          const delivery = new Date(l.actual_offloading_arrival!).getTime();
          return acc + (delivery - loading);
        }, 0) / deliveredWithActual.length
        : 0;

    return {
      activeInTransit: loadsWithETA.filter((l) => l.status === 'in-transit').length,
      scheduled: loadsWithETA.filter((l) => l.status === 'scheduled').length,
      deliveredToday: todayDeliveries.length,
      avgDeliveryTime: Math.round(avgDeliveryTimeMs / (1000 * 60 * 60)),
    };
  }, [loadsWithETA, allLoads]);

  const isLoading = activeLoading || allLoading;

  /* ——— Render ——— */
  return (
    <div className="space-y-5">
      {/* KPI Stats - Modern grid with clean cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="In Transit"
          value={stats.activeInTransit}
          icon={Truck}
          trend={stats.activeInTransit > 0 ? '+12%' : undefined}
        />
        <StatCard
          title="Scheduled"
          value={stats.scheduled}
          icon={Clock}
        />
        <StatCard
          title="Delivered Today"
          value={stats.deliveredToday}
          icon={CheckCircle2}
        />
        <StatCard
          title="Avg. Delivery"
          value={`${stats.avgDeliveryTime}h`}
          icon={Gauge}
          subtitle="Average time"
        />
      </div>

      {/* Active Deliveries — Modern Card */}
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="px-5 py-3 border-b border-border/40 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Active Deliveries</CardTitle>
                <p className="text-xs text-muted-foreground">Currently in progress or scheduled</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[11px] font-medium px-2 py-1 rounded-full">
              {loadsWithETA.length} {loadsWithETA.length === 1 ? 'shipment' : 'shipments'}
            </Badge>
          </div>
          {lastTelematicsUpdate && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Tracking updated {Math.round((Date.now() - lastTelematicsUpdate.getTime()) / 1000)}s ago · refreshes every 30s
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : loadsWithETA.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active deliveries"
              description="In-progress shipments will appear here"
            />
          ) : (
            <div className="divide-y divide-border/40">
              {loadsWithETA.map((load) => (
                <DeliveryRow key={load.id} load={load} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Shipments — Searchable & Filterable */}
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="px-5 py-3 border-b border-border/40 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted text-foreground">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">All Shipments</CardTitle>
                <CardDescription className="text-xs">Search and filter your shipment history</CardDescription>
              </div>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by load ID, origin, destination..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => updateParam('q', e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => updateParam('status', value)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in-transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={(value) => updateParam('date', value)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {allLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            <EmptyState
              icon={hasActiveFilters ? Filter : Box}
              title={hasActiveFilters ? 'No loads match your filters' : 'No shipments yet'}
              description={hasActiveFilters ? 'Try adjusting your search or filters' : 'Your shipments will appear here'}
            />
          ) : (
            <>
              {/* Pagination header */}
              {filteredLoads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 text-sm text-muted-foreground">
                  <span>
                    Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredLoads.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredLoads.length)} of {filteredLoads.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1))}>
                      Previous
                    </Button>
                    <span className="text-xs font-medium">
                      Page {currentPage} of {Math.ceil(filteredLoads.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button variant="outline" size="sm" disabled={currentPage * ITEMS_PER_PAGE >= filteredLoads.length} onClick={() => updateParam('page', String(currentPage + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Load ID</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Loading Date</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoads
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((load) => (
                        <LoadRow key={load.id} load={load} clientId={clientId!} feedback={feedbackByLoadId.get(load.id) ?? null} />
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border/40">
                {filteredLoads
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((load) => (
                    <MobileLoadCard key={load.id} load={load} clientId={clientId!} feedback={feedbackByLoadId.get(load.id) ?? null} />
                  ))}
              </div>

              {/* Bottom pagination */}
              {filteredLoads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border/40">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1))}>
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground">
                    Page {currentPage} of {Math.ceil(filteredLoads.length / ITEMS_PER_PAGE)}
                  </span>
                  <Button variant="outline" size="sm" disabled={currentPage * ITEMS_PER_PAGE >= filteredLoads.length} onClick={() => updateParam('page', String(currentPage + 1))}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */

/** Modern Stat Card */
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: string;
  subtitle?: string;
}) {
  return (
    <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              {trend && (
                <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                  {trend}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-primary/5 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Single active delivery row — Modern professional list format */
function DeliveryRow({ load }: { load: LoadWithETA }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const progress = load.progressData?.progress ?? 0;
  const hasTracking = !!load.telematicsAsset;
  const timeWindow = parseTimeWindow(load.time_window);

  // Calculate variances against planned event times in time_window
  const loadingArrivalVariance = getVarianceLabel(
    load.actual_loading_arrival,
    timeWindow.origin.plannedArrival,
    'loading_arrival'
  );

  const loadingDepartureVariance = getVarianceLabel(
    load.actual_loading_departure,
    timeWindow.origin.plannedDeparture,
    'loading_departure'
  );

  const offloadingArrivalVariance = getVarianceLabel(
    load.actual_offloading_arrival,
    timeWindow.destination.plannedArrival,
    'offloading_arrival'
  );

  const offloadingDepartureVariance = getVarianceLabel(
    load.actual_offloading_departure,
    timeWindow.destination.plannedDeparture,
    'offloading_departure'
  );

  return (
    <div className="px-5 py-3 hover:bg-muted/30 transition-colors">
      {/* Desktop Layout */}
      <div className="hidden lg:block space-y-2">
        {/* Main Row — grid for proportional sizing */}
        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(180px,2fr)_minmax(160px,1.2fr)_auto] items-center gap-5">
          {/* Load ID & Vehicle */}
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-foreground truncate">{load.load_id}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{load.fleet_vehicle?.vehicle_id || 'No vehicle'}</span>
            </div>
          </div>

          {/* Route */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="truncate text-muted-foreground">{origin}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <MapPin className="h-3 w-3 text-success flex-shrink-0" />
              <span className="truncate text-muted-foreground">{destination}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {safeFormatDate(load.loading_date, 'dd MMM')} → {safeFormatDate(load.offloading_date, 'dd MMM')}
              </span>
            </div>
          </div>

          {/* Progress & ETA */}
          <div className="min-w-0">
            {load.status === 'in-transit' && hasTracking && load.progressData ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1" />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">ETA {load.progressData.etaFormatted}</span>
                  <span className="font-medium">{load.progressData.distanceRemaining?.toFixed(0)} km</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground bg-muted/30 rounded py-2">
                {load.status === 'scheduled' ? 'Scheduled' : 'No tracking'}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex-shrink-0 justify-self-end">
            <StatusBadge status={load.status} size="sm" />
          </div>
        </div>

        {/* Timing Details — compact single row */}
        <div className="grid grid-cols-4 gap-5 pt-2 border-t border-border/30 text-[11px]">
          {/* Loading Point */}
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <LogIn className="h-3 w-3" /> Load Arrival
            </p>
            <p className="text-xs">{formatDateTime(load.actual_loading_arrival)}</p>
            <p className={cn('text-[10px] font-medium', loadingArrivalVariance.className)}>{loadingArrivalVariance.label}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <LogIn className="h-3 w-3" /> Load Depart
            </p>
            <p className="text-xs">{formatDateTime(load.actual_loading_departure)}</p>
            <p className={cn('text-[10px] font-medium', loadingDepartureVariance.className)}>{loadingDepartureVariance.label}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <LogOut className="h-3 w-3" /> Offload Arrival
            </p>
            <p className="text-xs">{formatDateTime(load.actual_offloading_arrival)}</p>
            <p className={cn('text-[10px] font-medium', offloadingArrivalVariance.className)}>{offloadingArrivalVariance.label}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-1">
              <LogOut className="h-3 w-3" /> Offload Depart
            </p>
            <p className="text-xs">{formatDateTime(load.actual_offloading_departure)}</p>
            <p className={cn('text-[10px] font-medium', offloadingDepartureVariance.className)}>{offloadingDepartureVariance.label}</p>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden space-y-2.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs font-semibold">{load.load_id}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{load.fleet_vehicle?.vehicle_id || 'No vehicle'}</p>
          </div>
          <StatusBadge status={load.status} size="sm" />
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-muted-foreground truncate">{origin}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-success flex-shrink-0" />
            <span className="text-muted-foreground truncate">{destination}</span>
          </div>
        </div>

        {load.status === 'in-transit' && hasTracking && load.progressData && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1" />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">ETA {load.progressData.etaFormatted}</span>
              <span className="font-medium">{load.progressData.distanceRemaining?.toFixed(0)} km</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-[11px]">
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
              <LogIn className="h-2.5 w-2.5" /> Loading
            </p>
            <p>In: {formatDateTime(load.actual_loading_arrival)} <span className={loadingArrivalVariance.className}>{loadingArrivalVariance.label}</span></p>
            <p>Out: {formatDateTime(load.actual_loading_departure)} <span className={loadingDepartureVariance.className}>{loadingDepartureVariance.label}</span></p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
              <LogOut className="h-2.5 w-2.5" /> Offloading
            </p>
            <p>In: {formatDateTime(load.actual_offloading_arrival)} <span className={offloadingArrivalVariance.className}>{offloadingArrivalVariance.label}</span></p>
            <p>Out: {formatDateTime(load.actual_offloading_departure)} <span className={offloadingDepartureVariance.className}>{offloadingDepartureVariance.label}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Desktop table row for all-shipments table */
function LoadRow({ load, clientId, feedback }: { load: Load; clientId: string; feedback: ClientFeedback | null }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold">{load.load_id}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <span>{origin}</span>
          <span className="text-muted-foreground">→</span>
          <span>{destination}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {safeFormatDate(load.loading_date, 'dd MMM yyyy')}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {safeFormatDate(load.offloading_date, 'dd MMM yyyy')}
        </div>
      </TableCell>
      <TableCell>
        {load.fleet_vehicle ? (
          <div className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{load.fleet_vehicle.vehicle_id}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {load.driver ? <span>{load.driver.name}</span> : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <StatusBadge status={load.status} />
      </TableCell>
      <TableCell className="text-right">
        {load.status === 'delivered' ? (
          <FeedbackWidget loadId={load.id} clientId={clientId} existingFeedback={feedback} compact />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Mobile card for all-shipments list */
function MobileLoadCard({ load, clientId, feedback }: { load: Load; clientId: string; feedback: ClientFeedback | null }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);

  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{load.load_id}</span>
        </div>
        <StatusBadge status={load.status} />
      </div>
      <div className="text-sm text-muted-foreground truncate">
        {origin} → {destination}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Load: {safeFormatDate(load.loading_date, 'dd MMM')}
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Del: {safeFormatDate(load.offloading_date, 'dd MMM')}
        </div>
        {load.fleet_vehicle && (
          <div className="flex items-center gap-1">
            <Truck className="h-3 w-3" />
            {load.fleet_vehicle.vehicle_id}
          </div>
        )}
        {load.driver && <span>{load.driver.name}</span>}
      </div>
      {load.status === 'delivered' && (
        <div className="pt-2 border-t border-border/40">
          <FeedbackWidget loadId={load.id} clientId={clientId} existingFeedback={feedback} compact />
        </div>
      )}
    </div>
  );
}

/** Empty state placeholder — Clean minimal design */
function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 rounded-2xl bg-muted/50">
        <Icon className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}