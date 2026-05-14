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
import { getSubcontractorInfo, parseTimeWindow, timeToSASTMinutes } from '@/lib/timeWindow';
import { getEffectiveLoadStatus } from '@/lib/loadStatus';
import { cn, getLocationDisplayName, safeFormatDate } from '@/lib/utils';
import { parseISO } from 'date-fns';
import {
  Box,
  CheckCircle2,
  Clock,
  Filter,
  Gauge,
  LogIn,
  LogOut,
  Package,
  Search,
  Truck,
  X,
  ChevronLeft,
  ChevronRight
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
 * Returns Tailwind text color classes for immediate styling.
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

  const formatHours = (mins: number) => (mins / 60).toFixed(mins % 60 === 0 ? 0 : 1);

  // Arrival events
  if (eventType === 'loading_arrival' || eventType === 'offloading_arrival') {
    if (absMins <= 10) return { label: 'On time', className: 'text-emerald-600 dark:text-emerald-400' };

    if (absMins >= 60) {
      return diffMins > 0
        ? { label: `+${formatHours(absMins)}h late`, className: 'text-red-600 dark:text-red-400' }
        : { label: `-${formatHours(absMins)}h early`, className: 'text-emerald-600 dark:text-emerald-400' };
    }

    return diffMins > 0
      ? { label: `+${absMins}m late`, className: 'text-red-600 dark:text-red-400' }
      : { label: `-${absMins}m early`, className: 'text-emerald-600 dark:text-emerald-400' };
  }

  // Departure events (early and late are problematic)
  if (eventType === 'loading_departure' || eventType === 'offloading_departure') {
    if (absMins <= 10) return { label: 'On time', className: 'text-emerald-600 dark:text-emerald-400' };

    if (absMins >= 60) {
      return {
        label: `${diffMins > 0 ? '+' : '-'}${formatHours(absMins)}h`,
        className: 'text-amber-600 dark:text-amber-400'
      };
    }

    return {
      label: `${diffMins > 0 ? '+' : '-'}${absMins}m`,
      className: 'text-amber-600 dark:text-amber-400'
    };
  }

  return { label: '—', className: 'text-muted-foreground' };
}

/* ——— Main Component ——— */

export default function ClientDeliveriesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  // Default to empty string if clientId is somehow missing to prevent strict type issues deeper down
  const safeClientId = clientId ?? '';

  const { data: activeLoads = [], isLoading: activeLoading } = useClientActiveLoads(safeClientId);
  const { data: allLoads = [], isLoading: allLoading } = useClientLoads(safeClientId);
  const { data: customLocations = [] } = useCustomLocations();
  const { data: feedbackList = [] } = useClientFeedback(safeClientId);

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

  // ── Loads table filtering ──
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

  const clearFilters = () => setSearchParams({});
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* KPI Stats - Modern grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="In Transit"
          value={stats.activeInTransit}
          icon={Truck}
          isLive={stats.activeInTransit > 0}
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
          title="Avg. Transit Time"
          value={stats.avgDeliveryTime > 0 ? `${stats.avgDeliveryTime}h` : '—'}
          icon={Gauge}
          subtitle="Loading to delivery"
        />
      </div>

      {/* Active Deliveries */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Active Deliveries</CardTitle>
                <CardDescription className="text-xs">Currently moving or preparing to depart</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastTelematicsUpdate && (
                <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live sync ({Math.round((Date.now() - lastTelematicsUpdate.getTime()) / 1000)}s)
                </span>
              )}
              <Badge variant="secondary" className="px-2.5 py-1 rounded-full">
                {loadsWithETA.length} {loadsWithETA.length === 1 ? 'Active' : 'Active'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : loadsWithETA.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No active deliveries"
              description="In-progress shipments will appear here automatically."
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

      {/* All Shipments */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Shipment History</CardTitle>
                <CardDescription className="text-xs">Search and filter your complete logs</CardDescription>
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search loads, locations..."
                  className="pl-9 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => updateParam('q', e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => updateParam('status', value)}>
                <SelectTrigger className="h-9 w-full sm:w-[140px] text-sm">
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
                <SelectTrigger className="h-9 w-full sm:w-[140px] text-sm">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {allLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            <EmptyState
              icon={hasActiveFilters ? Filter : Box}
              title={hasActiveFilters ? 'No matches found' : 'No shipments logged yet'}
              description={hasActiveFilters ? 'Try adjusting your search or clearing filters.' : 'Completed and pending shipments will populate here.'}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Load ID</TableHead>
                      <TableHead className="font-semibold">Route</TableHead>
                      <TableHead className="font-semibold">Dates</TableHead>
                      <TableHead className="font-semibold">Vehicle & Driver</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoads
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((load) => (
                        <LoadRow key={load.id} load={load} clientId={safeClientId} feedback={feedbackByLoadId.get(load.id) ?? null} />
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border/40">
                {filteredLoads
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((load) => (
                    <MobileLoadCard key={load.id} load={load} clientId={safeClientId} feedback={feedbackByLoadId.get(load.id) ?? null} />
                  ))}
              </div>

              {/* Enhanced Pagination */}
              {filteredLoads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/10">
                  <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                    Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredLoads.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLoads.length)} of {filteredLoads.length} entries
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shadow-sm"
                      disabled={currentPage <= 1}
                      onClick={() => updateParam('page', String(currentPage - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <span className="text-xs font-semibold px-2">
                      {currentPage} / {Math.ceil(filteredLoads.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shadow-sm"
                      disabled={currentPage * ITEMS_PER_PAGE >= filteredLoads.length}
                      onClick={() => updateParam('page', String(currentPage + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
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

/** Modern Stat Card with optional pulsing indicator */
function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  isLive
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  isLive?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-sm transition-all hover:shadow-md bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                </span>
              )}
              <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            </div>
            {subtitle && (
              <p className="text-[11px] font-medium text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="p-2.5 rounded-xl bg-muted border border-border/50 text-foreground">
            <Icon className="h-5 w-5" />
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
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  // Variances against planned times
  const loadingArrivalVariance = getVarianceLabel(load.actual_loading_arrival, timeWindow.origin.plannedArrival, 'loading_arrival');
  const loadingDepartureVariance = getVarianceLabel(load.actual_loading_departure, timeWindow.origin.plannedDeparture, 'loading_departure');
  const offloadingArrivalVariance = getVarianceLabel(load.actual_offloading_arrival, timeWindow.destination.plannedArrival, 'offloading_arrival');
  const offloadingDepartureVariance = getVarianceLabel(load.actual_offloading_departure, timeWindow.destination.plannedDeparture, 'offloading_departure');

  return (
    <div className="p-6 hover:bg-muted/20 transition-colors group">
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">

        {/* Load & Vehicle Identity */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border shadow-sm">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-foreground">{load.load_id}</h4>
              <StatusBadge status={displayStatus} size="sm" />
              {subcontractor && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  title={`Carried by subcontractor: ${subcontractor.name}`}
                >
                  Subcontractor · {subcontractor.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
              <Truck className="h-3.5 w-3.5" />
              {load.fleet_vehicle?.vehicle_id || (subcontractor ? subcontractor.name : 'Vehicle Unassigned')}
              <span className="mx-1 text-border">•</span>
              <span>{load.driver?.name || (subcontractor ? 'Subcontractor driver' : 'No Driver')}</span>
            </div>
          </div>
        </div>

        {/* Live Progress Bar (Desktop) */}
        <div className="hidden lg:block w-[280px] shrink-0">
          {load.status === 'in-transit' && hasTracking && load.progressData ? (
            <div className="space-y-2">
              <div className="flex items-end justify-between text-xs">
                <span className="font-semibold text-primary">{Math.round(progress)}% Complete</span>
                <span className="font-medium text-muted-foreground">ETA: {load.progressData.etaFormatted}</span>
              </div>
              <Progress value={progress} className="h-2 bg-muted border" />
              <div className="flex justify-end text-[10px] text-muted-foreground font-medium">
                {load.progressData.distanceRemaining?.toFixed(0)} km remaining
              </div>
            </div>
          ) : (
            <div className="h-12 flex items-center justify-center rounded-lg border border-dashed bg-muted/30 text-xs font-medium text-muted-foreground">
              {load.status === 'scheduled' ? 'Awaiting Departure' : 'Tracking Unavailable'}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid: Route & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-6">

        {/* Route Info */}
        <div className="space-y-4">
          <div className="relative pl-6 space-y-4">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border"></div>

            {/* Origin */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 h-3 w-3 rounded-full border-2 border-primary bg-background"></div>
              <p className="text-sm font-semibold">{origin}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Planned: {safeFormatDate(timeWindow.origin.plannedArrival, 'dd MMM, HH:mm', 'TBD')}
              </p>
            </div>

            {/* Destination */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 h-3 w-3 rounded-full border-2 border-destructive bg-background"></div>
              <p className="text-sm font-semibold">{destination}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Planned: {safeFormatDate(timeWindow.destination.plannedArrival, 'dd MMM, HH:mm', 'TBD')}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline Event Blocks */}
        <div className="grid grid-cols-2 gap-3">
          {/* Loading Block */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
              <LogIn className="h-3.5 w-3.5" /> Loading Point
            </h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Arrived</span>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatDateTime(load.actual_loading_arrival)}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', loadingArrivalVariance.className)}>{loadingArrivalVariance.label}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Departed</span>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatDateTime(load.actual_loading_departure)}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', loadingDepartureVariance.className)}>{loadingDepartureVariance.label}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Offloading Block */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
              <LogOut className="h-3.5 w-3.5" /> Delivery Point
            </h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Arrived</span>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatDateTime(load.actual_offloading_arrival)}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', offloadingArrivalVariance.className)}>{offloadingArrivalVariance.label}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Departed</span>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatDateTime(load.actual_offloading_departure)}</p>
                  <p className={cn('text-[10px] font-bold mt-0.5', offloadingDepartureVariance.className)}>{offloadingDepartureVariance.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Progress Bar */}
      <div className="lg:hidden mt-5 pt-5 border-t">
        {load.status === 'in-transit' && hasTracking && load.progressData ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between text-xs">
              <span className="font-semibold text-primary">{Math.round(progress)}% Complete</span>
              <span className="font-medium text-muted-foreground">ETA: {load.progressData.etaFormatted}</span>
            </div>
            <Progress value={progress} className="h-2 bg-muted border" />
          </div>
        ) : (
          <div className="text-xs font-medium text-muted-foreground text-center bg-muted/30 py-2 rounded">
            {load.status === 'scheduled' ? 'Awaiting Departure' : 'Tracking Unavailable'}
          </div>
        )}
      </div>
    </div>
  );
}

/** Desktop table row for all-shipments table */
function LoadRow({ load, clientId, feedback }: { load: Load; clientId: string; feedback: ClientFeedback | null }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  return (
    <TableRow className="hover:bg-muted/40 transition-colors">
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          <span>{load.load_id}</span>
          {subcontractor && (
            <Badge
              variant="outline"
              className="w-fit text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              title={`Carried by subcontractor: ${subcontractor.name}`}
            >
              Subcontractor · {subcontractor.name}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="truncate max-w-[150px] xl:max-w-[200px]">{origin}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
            <span className="truncate max-w-[150px] xl:max-w-[200px]">{destination}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-8 font-semibold">Load:</span>
            <span>{safeFormatDate(load.loading_date, 'dd MMM yyyy')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-8 font-semibold">Drop:</span>
            <span>{safeFormatDate(load.offloading_date, 'dd MMM yyyy')}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-1.5 font-medium">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            {load.fleet_vehicle?.vehicle_id || (
              <span className="text-muted-foreground italic">
                {subcontractor ? subcontractor.name : 'Unassigned'}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground ml-5">
            {load.driver?.name || (subcontractor ? 'Subcontractor driver' : '—')}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={displayStatus} />
      </TableCell>
      <TableCell className="text-right">
        {displayStatus === 'delivered' ? (
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
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  return (
    <div className="p-5 space-y-4 bg-card">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold text-sm">{load.load_id}</div>
          {subcontractor && (
            <Badge
              variant="outline"
              className="text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              title={`Carried by subcontractor: ${subcontractor.name}`}
            >
              Subcontractor · {subcontractor.name}
            </Badge>
          )}
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className="h-2 w-2 rounded-full border-2 border-primary" />
            <div className="h-6 w-px bg-border" />
            <div className="h-2 w-2 rounded-full border-2 border-destructive" />
          </div>
          <div className="flex-1 space-y-2 text-sm font-medium">
            <div className="flex justify-between items-center">
              <span className="truncate">{origin}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="truncate">{destination}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
          <div>
            <p className="text-muted-foreground mb-0.5">Loading Date</p>
            <p className="font-medium">{safeFormatDate(load.loading_date, 'dd MMM yyyy')}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Vehicle</p>
            <p className="font-medium">{load.fleet_vehicle?.vehicle_id || (subcontractor ? subcontractor.name : '—')}</p>
          </div>
        </div>
      </div>

      {displayStatus === 'delivered' && (
        <div className="pt-3 border-t">
          <FeedbackWidget loadId={load.id} clientId={clientId} existingFeedback={feedback} compact />
        </div>
      )}
    </div>
  );
}

/** Empty state placeholder — Clean minimal design */
function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4 shadow-sm border border-border/50">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
    </div>
  );
}