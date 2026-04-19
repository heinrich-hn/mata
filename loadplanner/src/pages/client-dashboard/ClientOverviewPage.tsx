import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useClient, useClientActiveLoads, useClientLoads } from '@/hooks/useClientLoads';
import type { Load } from '@/hooks/useTrips';
import { cn, getLocationDisplayName, safeFormatDate } from '@/lib/utils';
import {
  endOfMonth,
  endOfWeek,
  formatDistanceToNow,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

export default function ClientOverviewPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: allLoads = [], isLoading: loadsLoading } = useClientLoads(clientId);
  const { data: activeLoads = [] } = useClientActiveLoads(clientId);

  const basePath = location.pathname.startsWith('/portal') ? '/portal' : '/customers';

  const isLoading = clientLoading || loadsLoading;

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const thisWeekLoads = allLoads.filter((l) => {
      const date = parseISO(l.loading_date);
      return date >= weekStart && date <= weekEnd;
    });

    const thisMonthLoads = allLoads.filter((l) => {
      const date = parseISO(l.loading_date);
      return date >= monthStart && date <= monthEnd;
    });

    return {
      total: allLoads.length,
      delivered: allLoads.filter((l) => l.status === 'delivered').length,
      inTransit: allLoads.filter((l) => l.status === 'in-transit').length,
      scheduled: allLoads.filter((l) => l.status === 'scheduled' || l.status === 'pending').length,
      thisWeek: thisWeekLoads.length,
      thisMonth: thisMonthLoads.length,
      deliveredThisMonth: thisMonthLoads.filter((l) => l.status === 'delivered').length,
    };
  }, [allLoads]);

  // Calculate delivery rate
  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  // Recent activity
  const recentActivity = useMemo(() => {
    return allLoads
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [allLoads]);

  // Upcoming scheduled
  const upcomingLoads = useMemo(() => {
    const now = new Date();
    return allLoads
      .filter((l) => l.status === 'scheduled' && parseISO(l.loading_date) >= now)
      .sort((a, b) => new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime())
      .slice(0, 3);
  }, [allLoads]);

  // For "Marketing" client: next loading origin per vehicle
  const isMarketingClient = client?.name?.toLowerCase() === 'marketing';
  const nextLoadingOrigins = useMemo(() => {
    if (!isMarketingClient) return [];
    // Get upcoming & in-transit loads grouped by vehicle
    const vehicleNextLoad = new Map<string, Load>();
    const upcoming = allLoads
      .filter((l) => (l.status === 'scheduled' || l.status === 'in-transit' || l.status === 'pending') && l.fleet_vehicle?.vehicle_id)
      .sort((a, b) => new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime());
    for (const load of upcoming) {
      const vid = load.fleet_vehicle!.vehicle_id;
      if (!vehicleNextLoad.has(vid)) {
        vehicleNextLoad.set(vid, load);
      }
    }
    return Array.from(vehicleNextLoad.entries()).map(([vehicleId, load]) => ({
      vehicleId,
      origin: getLocationDisplayName(load.origin),
      destination: getLocationDisplayName(load.destination),
      loadingDate: load.loading_date,
      loadId: load.load_id,
      status: load.status,
    }));
  }, [allLoads, isMarketingClient]);

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-12rem)]">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {isLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : (
          <Card className="relative overflow-hidden border-subtle shadow-lg bg-gradient-to-br from-white via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                  >
                    Welcome back{client?.contact_person ? `, ${client.contact_person.split(' ')[0]}` : ''}
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-muted-foreground"
                  >
                    Here's an overview of your shipment activity with <span className="font-semibold text-primary">{client?.name || 'your account'}</span>
                  </motion.p>
                </div>
                <motion.div 
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className="hidden md:block"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
                    <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 backdrop-blur-sm">
                      <Package className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatsCard
          title="Total Shipments"
          value={stats.total}
          icon={Package}
          color="purple"
          loading={isLoading}
          delay={0}
        />
        <StatsCard
          title="In Transit"
          value={stats.inTransit}
          icon={Truck}
          color="blue"
          loading={isLoading}
          delay={0.1}
        />
        <StatsCard
          title="Delivered"
          value={stats.delivered}
          icon={CheckCircle2}
          color="green"
          loading={isLoading}
          delay={0.2}
        />
        <StatsCard
          title="Scheduled"
          value={stats.scheduled}
          icon={Clock}
          color="amber"
          loading={isLoading}
          delay={0.3}
        />
      </div>

      {/* Next Loading Origins — Marketing only */}
      <AnimatePresence>
        {isMarketingClient && nextLoadingOrigins.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-subtle shadow-lg overflow-hidden">
              <CardHeader className="border-b border-subtle bg-gradient-to-r from-primary/5 via-transparent to-transparent py-4">
                <div className="flex items-center gap-3">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="p-2 rounded-lg bg-primary/10 text-primary shadow-sm"
                  >
                    <MapPin className="h-5 w-5" />
                  </motion.div>
                  <div>
                    <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">
                      Next Loading Origins
                    </CardTitle>
                    <CardDescription>Where each vehicle will be loading from next</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {nextLoadingOrigins.map((item, index) => (
                    <motion.div
                      key={item.vehicleId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ backgroundColor: "hsl(var(--subtle) / 0.7)" }}
                      className="flex items-center justify-between px-5 py-3 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle border border-subtle flex-shrink-0 shadow-sm">
                          <Truck className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.vehicleId}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.loadId} &middot; {item.origin} → {item.destination}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-medium text-primary">{item.origin}</p>
                        <p className="text-xs text-muted-foreground">{safeFormatDate(item.loadingDate, 'dd MMM yyyy')}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Active Deliveries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="border-b border-subtle bg-gradient-to-r from-blue-500/5 via-transparent to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2">
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Navigation className="h-5 w-5 text-primary" />
                    </motion.div>
                    Active Deliveries
                  </CardTitle>
                  <CardDescription>Shipments currently in progress</CardDescription>
                </div>
                <Link to={`${basePath}/${clientId}/deliveries`}>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-accent hover:scale-105 transition-all duration-200"
                  >
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : activeLoads.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active deliveries right now</p>
                </motion.div>
              ) : (
                <div className="divide-y">
                  {activeLoads.slice(0, 4).map((load, index) => (
                    <ActiveLoadItem key={load.id} load={load} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Scheduled */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="border-b border-subtle bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Shipments
                  </CardTitle>
                  <CardDescription>Next scheduled deliveries</CardDescription>
                </div>
                <Link to={`${basePath}/${clientId}/loads`}>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-accent hover:scale-105 transition-all duration-200"
                  >
                    View All
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : upcomingLoads.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No upcoming shipments scheduled</p>
                </motion.div>
              ) : (
                <div className="divide-y">
                  {upcomingLoads.map((load, index) => (
                    <UpcomingLoadItem key={load.id} load={load} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="border-b border-subtle bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <TrendingUp className="h-5 w-5 text-primary" />
                </motion.div>
                Delivery Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <>
                  <div className="text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="text-5xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent"
                    >
                      {deliveryRate}%
                    </motion.div>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">Completion Rate</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">This Week</span>
                        <span className="font-semibold">{stats.thisWeek} loads</span>
                      </div>
                      <Progress value={stats.thisWeek > 0 ? 100 : 0} className="h-2.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">This Month</span>
                        <span className="font-semibold">{stats.thisMonth} loads</span>
                      </div>
                      <Progress value={stats.thisMonth > 0 ? 100 : 0} className="h-2.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Delivered This Month</span>
                        <span className="font-semibold">{stats.deliveredThisMonth}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div 
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="border-subtle shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="border-b border-subtle bg-gradient-to-r from-slate-500/5 via-transparent to-transparent">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates on your shipments</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Box className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity yet</p>
                </motion.div>
              ) : (
                <div className="divide-y">
                  {recentActivity.map((load, index) => (
                    <RecentActivityItem key={load.id} load={load} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
  delay = 0,
}: {
  title: string;
  value: number;
  icon: typeof Package;
  color: 'purple' | 'blue' | 'green' | 'amber';
  loading?: boolean;
  delay?: number;
}) {
  const colorClasses = {
    purple: 'bg-gradient-to-br from-purple-500/10 to-purple-500/5 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    blue: 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-4">
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="kpi-card shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-4">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={cn('flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm', colorClasses[color])}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
            <div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.1 }}
                className="text-2xl font-bold tracking-tight"
              >
                {value}
              </motion.p>
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ActiveLoadItem({ load, index }: { load: Load; index: number }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ backgroundColor: "hsl(var(--subtle) / 0.7)", scale: 1.01 }}
      className="py-3.5 flex items-center justify-between px-1.5 rounded-lg transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <motion.div 
          whileHover={{ rotate: 5 }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-200 dark:border-blue-800 shadow-sm"
        >
          <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </motion.div>
        <div>
          <p className="font-semibold text-sm">{load.load_id}</p>
          <p className="text-xs text-muted-foreground">
            {origin} → {destination}
          </p>
        </div>
      </div>
      <Badge 
        variant={load.status === 'in-transit' ? 'default' : 'outline'}
        className="animate-pulse"
      >
        {load.status}
      </Badge>
    </motion.div>
  );
}

function UpcomingLoadItem({ load, index }: { load: Load; index: number }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ backgroundColor: "hsl(var(--subtle) / 0.7)", scale: 1.01 }}
      className="py-3.5 flex items-center justify-between px-1.5 rounded-lg transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <motion.div 
          whileHover={{ rotate: 5 }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 dark:border-amber-800 shadow-sm"
        >
          <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </motion.div>
        <div>
          <p className="font-semibold text-sm">{load.load_id}</p>
          <p className="text-xs text-muted-foreground">
            {origin} → {destination}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{safeFormatDate(load.loading_date, 'dd MMM')}</p>
        <p className="text-xs text-muted-foreground">
          {(() => { try { return formatDistanceToNow(parseISO(load.loading_date), { addSuffix: true }); } catch { return '—'; } })()}
        </p>
      </div>
    </motion.div>
  );
}

function RecentActivityItem({ load, index }: { load: Load; index: number }) {
  const getStatusIcon = () => {
    switch (load.status) {
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'in-transit':
        return <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Package className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    switch (load.status) {
      case 'delivered':
        return 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-800';
      case 'in-transit':
        return 'bg-blue-500/10 border-blue-200 dark:border-blue-800';
      case 'scheduled':
        return 'bg-amber-500/10 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-500/10 border-slate-200 dark:border-slate-800';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ backgroundColor: "hsl(var(--subtle) / 0.7)", scale: 1.01 }}
      className="py-3 flex items-center justify-between px-1.5 rounded-lg transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <motion.div 
          whileHover={{ scale: 1.1 }}
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm', getStatusColor())}
        >
          {getStatusIcon()}
        </motion.div>
        <div>
          <p className="text-sm">
            <span className="font-semibold">{load.load_id}</span>
            <span className="text-muted-foreground"> • </span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {load.status}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {getLocationDisplayName(load.origin)} → {getLocationDisplayName(load.destination)}
          </p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">
        {formatDistanceToNow(parseISO(load.updated_at), { addSuffix: true })}
      </span>
    </motion.div>
  );
}