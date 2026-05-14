import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useClient, useClientActiveLoads, useClientLoads } from '@/hooks/useClientLoads';
import type { Load } from '@/hooks/useTrips';
import { getSubcontractorInfo } from '@/lib/timeWindow';
import { getEffectiveLoadStatus } from '@/lib/loadStatus';
import { cn, getLocationDisplayName, safeFormatDate } from '@/lib/utils';
import {
  endOfMonth,
  endOfWeek,
  formatDistanceToNow,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { motion } from 'framer-motion';
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                    Welcome back{client?.contact_person ? `, ${client.contact_person.split(' ')[0]}` : ''}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Shipment activity for <span className="font-medium text-foreground">{client?.name || 'your account'}</span>
                  </p>
                </div>
                <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-muted border border-border/60 text-foreground shrink-0">
                  <Package className="h-6 w-6" />
                </div>
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
      {isMarketingClient && nextLoadingOrigins.length > 0 && (
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Next Loading Origins</CardTitle>
                <CardDescription className="text-xs">Where each vehicle will be loading from next</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {nextLoadingOrigins.map((item) => (
                <div
                  key={item.vehicleId}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border/50 flex-shrink-0">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{item.vehicleId}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.loadId} &middot; {item.origin} → {item.destination}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-foreground">{item.origin}</p>
                    <p className="text-xs text-muted-foreground">{safeFormatDate(item.loadingDate, 'dd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Active Deliveries */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight">Active Deliveries</CardTitle>
                  <CardDescription className="text-xs">Shipments currently in progress</CardDescription>
                </div>
              </div>
              <Link to={`${basePath}/${clientId}/deliveries`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : activeLoads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active deliveries right now</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {activeLoads.slice(0, 4).map((load) => (
                  <ActiveLoadItem key={load.id} load={load} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Scheduled */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight">Upcoming Shipments</CardTitle>
                  <CardDescription className="text-xs">Next scheduled deliveries</CardDescription>
                </div>
              </div>
              <Link to={`${basePath}/${clientId}/loads`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : upcomingLoads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No upcoming shipments scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {upcomingLoads.map((load) => (
                  <UpcomingLoadItem key={load.id} load={load} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delivery Performance */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Delivery Performance</CardTitle>
                <CardDescription className="text-xs">Completion rate and recent volume</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div className="text-center">
                  <div className="text-5xl font-bold tracking-tight text-foreground">
                    {deliveryRate}<span className="text-2xl text-muted-foreground font-semibold">%</span>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-2 font-semibold">Completion Rate</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">This Week</span>
                      <span className="font-semibold">{stats.thisWeek} loads</span>
                    </div>
                    <Progress value={stats.thisWeek > 0 ? 100 : 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">This Month</span>
                      <span className="font-semibold">{stats.thisMonth} loads</span>
                    </div>
                    <Progress value={stats.thisMonth > 0 ? 100 : 0} className="h-2" />
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-muted-foreground">Delivered This Month</span>
                    <span className="font-semibold">{stats.deliveredThisMonth}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="px-6 py-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-foreground border border-border/50">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold tracking-tight">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Latest updates on your shipments</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Box className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {recentActivity.map((load) => (
                  <RecentActivityItem key={load.id} load={load} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
  const accentClasses = {
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-5">
          <Skeleton className="h-14" />
        </CardContent>
      </Card>
    );
  }

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

function ActiveLoadItem({ load }: { load: Load }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const subcontractor = getSubcontractorInfo(load);
  const displayStatus = getEffectiveLoadStatus(load);

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Truck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm">{load.load_id}</p>
            {subcontractor && <SubcontractorPill name={subcontractor.name} />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {origin} → {destination}
          </p>
        </div>
      </div>
      <Badge variant={displayStatus === 'in-transit' ? 'default' : 'outline'} className="flex-shrink-0">
        {displayStatus}
      </Badge>
    </div>
  );
}

function UpcomingLoadItem({ load }: { load: Load }) {
  const origin = getLocationDisplayName(load.origin);
  const destination = getLocationDisplayName(load.destination);
  const subcontractor = getSubcontractorInfo(load);

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm">{load.load_id}</p>
            {subcontractor && <SubcontractorPill name={subcontractor.name} />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {origin} → {destination}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold">{safeFormatDate(load.loading_date, 'dd MMM')}</p>
        <p className="text-xs text-muted-foreground">
          {(() => { try { return formatDistanceToNow(parseISO(load.loading_date), { addSuffix: true }); } catch { return '—'; } })()}
        </p>
      </div>
    </div>
  );
}

function RecentActivityItem({ load }: { load: Load }) {
  const displayStatus = getEffectiveLoadStatus(load);
  const getStatusIcon = () => {
    switch (displayStatus) {
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
    switch (displayStatus) {
      case 'delivered':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'in-transit':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'scheduled':
        return 'bg-amber-500/10 border-amber-500/20';
      default:
        return 'bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border flex-shrink-0', getStatusColor())}>
          {getStatusIcon()}
        </div>
        <div className="min-w-0">
          <div className="text-sm flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold">{load.load_id}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {displayStatus}
            </Badge>
            {getSubcontractorInfo(load) && <SubcontractorPill name={getSubcontractorInfo(load)!.name} />}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {getLocationDisplayName(load.origin)} → {getLocationDisplayName(load.destination)}
          </p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
        {(() => { try { return formatDistanceToNow(parseISO(load.updated_at), { addSuffix: true }); } catch { return '—'; } })()}
      </span>
    </div>
  );
}

function SubcontractorPill({ name }: { name: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-semibold uppercase tracking-wider border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0 h-4"
      title={`Carried by subcontractor: ${name}`}
    >
      Subcontractor · {name}
    </Badge>
  );
}