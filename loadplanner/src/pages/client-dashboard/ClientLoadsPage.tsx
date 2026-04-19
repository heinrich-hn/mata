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
import { parseTimeWindow } from '@/lib/timeWindow';
import { parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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
      <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
        <CardHeader className="border-b border-subtle bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Filter className="h-5 w-5 text-primary" />
                </motion.div>
                Filter Loads
              </CardTitle>
              <CardDescription>Search and filter your shipments</CardDescription>
            </div>
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Search by load ID, origin, destination..."
                  className="pl-9 border-subtle focus:border-primary transition-all duration-200"
                  value={searchQuery}
                  onChange={(e) => updateParam('q', e.target.value)}
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => updateParam('status', value)}
            >
              <SelectTrigger className="w-full sm:w-[160px] border-subtle hover:border-primary/50 transition-colors duration-200">
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
              <SelectTrigger className="w-full sm:w-[160px] border-subtle hover:border-primary/50 transition-colors duration-200">
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
      <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="border-b border-subtle bg-gradient-to-r from-slate-500/5 via-transparent to-transparent">
          <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">
            {filteredLoads.length} {filteredLoads.length === 1 ? 'Load' : 'Loads'}
            {hasActiveFilters && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="ml-2 text-xs font-normal text-muted-foreground"
              >
                (filtered)
              </motion.span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredLoads.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              </motion.div>
              {hasActiveFilters ? (
                <>
                  <p className="font-medium text-lg">No loads match your filters</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                  <Button
                    variant="outline"
                    className="mt-4 hover:scale-105 transition-transform"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium text-lg">No loads yet</p>
                  <p className="text-sm mt-1">Your shipments will appear here</p>
                </>
              )}
            </motion.div>
          ) : (
            <>
              {/* Pagination info */}
              <AnimatePresence>
                {filteredLoads.length > ITEMS_PER_PAGE && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between mb-4 text-sm text-muted-foreground"
                  >
                    <span className="font-medium">
                      Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredLoads.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredLoads.length)} of {filteredLoads.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => updateParam('page', String(currentPage - 1))}
                        className="hover:scale-105 transition-transform disabled:hover:scale-100"
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
                        className="hover:scale-105 transition-transform disabled:hover:scale-100"
                      >
                        Next
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Desktop Table */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden md:block overflow-x-auto rounded-lg border border-subtle"
              >
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
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
                    <AnimatePresence>
                      {filteredLoads
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((load, index) => (
                          <LoadRow key={load.id} load={load} index={index} />
                        ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </motion.div>

              {/* Mobile Card List */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="md:hidden space-y-3"
              >
                <AnimatePresence>
                  {filteredLoads
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((load, index) => (
                      <MobileLoadCard key={load.id} load={load} index={index} />
                    ))}
                </AnimatePresence>
              </motion.div>

              {/* Bottom pagination */}
              <AnimatePresence>
                {filteredLoads.length > ITEMS_PER_PAGE && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-end gap-2 mt-4"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => updateParam('page', String(currentPage - 1))}
                      className="hover:scale-105 transition-transform disabled:hover:scale-100"
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
                      className="hover:scale-105 transition-transform disabled:hover:scale-100"
                    >
                      Next
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
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
  const colorClasses = {
    slate: 'bg-gradient-to-br from-slate-500/10 to-slate-500/5 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    blue: 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    emerald: 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="kpi-card shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
        <CardHeader className="pb-2 p-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={cn('flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm', colorClasses[color])}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.1 }}
              className="text-2xl font-bold tracking-tight"
            >
              {value}
            </motion.span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadRow({ load, index }: { load: Load; index: number }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const timeWindow = parseTimeWindow(load.time_window);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
      className="group"
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 10 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Package className="h-4 w-4 text-primary" />
          </motion.div>
          <span className="font-semibold group-hover:text-primary transition-colors">{load.load_id}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <span className="truncate max-w-[120px]">{origin}</span>
          <motion.span
            className="text-muted-foreground"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          >
            →
          </motion.span>
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
            <Truck className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="font-medium">{load.fleet_vehicle.vehicle_id}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {load.driver ? (
          <span className="font-medium">{load.driver.name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge status={load.status} />
      </TableCell>
    </motion.tr>
  );
}

function MobileLoadCard({ load, index }: { load: Load; index: number }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const timeWindow = parseTimeWindow(load.time_window);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ scale: 1.02, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}
      className="border border-subtle bg-card rounded-xl p-3.5 space-y-2.5 shadow-md hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 10 }}
            className="p-1.5 bg-primary/10 rounded-lg"
          >
            <Package className="h-4 w-4 text-primary" />
          </motion.div>
          <span className="font-semibold text-sm">{load.load_id}</span>
        </div>
        <StatusBadge status={load.status} />
      </div>
      <div className="text-sm text-muted-foreground truncate">
        <span>{origin}</span>
        <motion.span
          className="mx-1"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          →
        </motion.span>
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
    </motion.div>
  );
}