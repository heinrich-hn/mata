import { StatusBadge } from '@/components/trips/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useClientLoads } from '@/hooks/useClientLoads';
import type { Load } from '@/hooks/useTrips';
import { cn, getLocationDisplayName, safeFormatDate } from '@/lib/utils';
import { getSubcontractorInfo, parseTimeWindow } from '@/lib/timeWindow';
import { getEffectiveLoadStatus } from '@/lib/loadStatus';
import { Badge } from '@/components/ui/badge';
import { parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Package,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

type StatusFilter = 'all' | 'scheduled' | 'in-transit' | 'delivered' | 'pending';

const ITEMS_PER_PAGE = 20;

export default function ClientLoadsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data: loads = [], isLoading } = useClientLoads(clientId);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const statusFilter = (searchParams.get('status') || 'all') as StatusFilter;
  const dateFilter = (searchParams.get('date') || 'all') as 'all' | 'today' | 'week' | 'month';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const updateParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '' || value === 'all' || (key === 'page' && value === '1')) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset page when changing filters
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  // Filter loads
  const filteredLoads = useMemo(() => {
    let result = [...loads];

    // Search filter
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

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((load) => load.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      result = result.filter((load) => {
        try {
          const loadDate = parseISO(load.loading_date);
          if (dateFilter === 'today') {
            return loadDate >= today;
          } else if (dateFilter === 'week') {
            return loadDate >= weekAgo;
          } else if (dateFilter === 'month') {
            return loadDate >= monthAgo;
          }
        } catch {
          return false;
        }
        return true;
      });
    }

    return result;
  }, [loads, searchQuery, statusFilter, dateFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: loads.length,
      scheduled: loads.filter((l) => l.status === 'scheduled').length,
      inTransit: loads.filter((l) => l.status === 'in-transit').length,
      delivered: loads.filter((l) => l.status === 'delivered').length,
    };
  }, [loads]);

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter !== 'all';

  const statsCards = [
    { title: "Total Loads", value: stats.total, icon: Package, color: "slate", delay: 0 },
    { title: "Scheduled", value: stats.scheduled, icon: Clock, color: "amber", delay: 0.1 },
    { title: "In Transit", value: stats.inTransit, icon: Truck, color: "blue", delay: 0.2 },
    { title: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "emerald", delay: 0.3 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="stats-grid">
        {statsCards.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color as 'slate' | 'blue' | 'emerald' | 'amber'}
            delay={stat.delay}
          />
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Filter Loads</CardTitle>
                <CardDescription className="text-xs">Search and filter your shipments</CardDescription>
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
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
            <Select
              value={statusFilter}
              onValueChange={(value) => updateParam('status', value)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
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
            <Select
              value={dateFilter}
              onValueChange={(value) => updateParam('date', value)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
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
        </CardContent>
      </Card>

      {/* Loads Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
          <CardTitle className="text-base font-semibold tracking-tight">
            {filteredLoads.length} {filteredLoads.length === 1 ? 'Load' : 'Loads'}
            {hasActiveFilters && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (filtered)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-14 w-14 mx-auto mb-4 opacity-30" />
              {hasActiveFilters ? (
                <>
                  <p className="font-medium text-base">No loads match your filters</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium text-base">No loads yet</p>
                  <p className="text-sm mt-1">Your shipments will appear here</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Pagination info */}
              {filteredLoads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                  <span className="font-medium">
                    Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredLoads.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredLoads.length)} of {filteredLoads.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => updateParam('page', String(currentPage - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-semibold px-3 py-1 bg-muted rounded-md">
                      Page {currentPage} of {Math.ceil(filteredLoads.length / ITEMS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage * ITEMS_PER_PAGE >= filteredLoads.length}
                      onClick={() => updateParam('page', String(currentPage + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Load ID</TableHead>
                      <TableHead className="font-semibold">Route</TableHead>
                      <TableHead className="font-semibold">Loading Date</TableHead>
                      <TableHead className="font-semibold">Delivery Date</TableHead>
                      <TableHead className="font-semibold">Vehicle</TableHead>
                      <TableHead className="font-semibold">Driver</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoads
                      .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      .map((load) => (
                        <LoadRow key={load.id} load={load} />
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {filteredLoads
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((load) => (
                    <MobileLoadCard key={load.id} load={load} />
                  ))}
              </div>

              {/* Bottom pagination */}
              {filteredLoads.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => updateParam('page', String(currentPage - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-semibold px-3 py-1 bg-muted rounded-md">
                    Page {currentPage} of {Math.ceil(filteredLoads.length / ITEMS_PER_PAGE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage * ITEMS_PER_PAGE >= filteredLoads.length}
                    onClick={() => updateParam('page', String(currentPage + 1))}
                  >
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

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: number;
  icon: typeof Package;
  color: 'slate' | 'blue' | 'emerald' | 'amber';
  delay?: number;
}) {
  const accentClasses = {
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Card className="border-border/60 shadow-sm transition-colors hover:bg-muted/20">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            </div>
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', accentClasses[color])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadRow({ load }: { load: Load }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const timeWindow = parseTimeWindow(load.time_window);
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{load.load_id}</span>
          </div>
          {subcontractor && (
            <Badge
              variant="outline"
              className="w-fit ml-6 text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              title={`Carried by subcontractor: ${subcontractor.name}`}
            >
              Subcontractor · {subcontractor.name}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <span className="truncate max-w-[120px]">{origin}</span>
          <span className="text-muted-foreground">→</span>
          <span className="truncate max-w-[120px]">{destination}</span>
        </div>
        {timeWindow.waypoints && timeWindow.waypoints.length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-[10px] text-orange-600 font-medium">via</span>
            {timeWindow.waypoints.map((wp, i) => (
              <span key={wp.id || i} className="text-[10px] text-muted-foreground">
                {i > 0 && <span className="mx-0.5">·</span>}
                {getLocationDisplayName(wp.placeName)}
              </span>
            ))}
          </div>
        )}
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
            <span className="font-medium">{load.fleet_vehicle.vehicle_id}</span>
          </div>
        ) : subcontractor ? (
          <span className="text-xs text-muted-foreground italic">{subcontractor.name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {load.driver ? (
          <span className="font-medium">{load.driver.name}</span>
        ) : subcontractor ? (
          <span className="text-xs text-muted-foreground italic">Subcontractor driver</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge status={displayStatus} />
      </TableCell>
    </TableRow>
  );
}

function MobileLoadCard({ load }: { load: Load }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const timeWindow = parseTimeWindow(load.time_window);
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  return (
    <div className="border border-border/60 bg-card rounded-xl p-3.5 space-y-2.5 shadow-sm hover:bg-muted/20 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-muted border border-border/50">
            <Package className="h-4 w-4 text-foreground" />
          </div>
          <span className="font-semibold text-sm truncate">{load.load_id}</span>
        </div>
        <StatusBadge status={displayStatus} />
      </div>
      {subcontractor && (
        <Badge
          variant="outline"
          className="w-fit text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          title={`Carried by subcontractor: ${subcontractor.name}`}
        >
          Subcontractor · {subcontractor.name}
        </Badge>
      )}
      <div className="text-sm text-muted-foreground truncate">
        <span>{origin}</span>
        <span className="mx-1">→</span>
        <span>{destination}</span>
      </div>
      {timeWindow.waypoints && timeWindow.waypoints.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-orange-600 font-medium">via</span>
          {timeWindow.waypoints.map((wp, i) => (
            <span key={wp.id || i} className="text-[10px] text-muted-foreground">
              {i > 0 && <span className="mx-0.5">·</span>}
              {getLocationDisplayName(wp.placeName)}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
            <span className="font-medium">{load.fleet_vehicle.vehicle_id}</span>
          </div>
        )}
        {load.driver && (
          <span className="font-medium">{load.driver.name}</span>
        )}
      </div>
    </div>
  );
}