import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock, Minus, Package, TrendingDown, TrendingUp, Truck } from "lucide-react";
import { useEffect } from "react";

interface RealTimeKPIMonitorProps {
  refreshInterval?: number; // milliseconds
}

interface KPIMetrics {
  activeLoads: number;
  activeLoadsChange: number;
  inTransitLoads: number;
  inTransitChange: number;
  avgDeliveryTime: number; // hours
  avgDeliveryTimeChange: number;
  onTimeDeliveryRate: number; // percentage
  onTimeDeliveryRateChange: number;
  pendingLoads: number;
  delayedLoads: number;
  completedToday: number;
  totalDistanceTraveled: number; // km
  avgSpeed: number; // km/h
}

export const RealTimeKPIMonitor = ({ refreshInterval = 30000 }: RealTimeKPIMonitorProps) => {
  // Fetch KPI metrics
  const { data: metrics, refetch } = useQuery({
    queryKey: ['load-kpi-metrics'],
    queryFn: async (): Promise<KPIMetrics> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Active statuses
      const activeStatuses = new Set(['assigned', 'in_transit', 'arrived_at_loading', 'loading', 'arrived_at_delivery', 'offloading']);

      // Fetch recent status changes for change calculations
      const { data: recentStatusChanges } = await supabase
        .from('delivery_events')
        .select('description')
        .eq('event_type', 'status_change')
        .gte('event_timestamp', twentyFourHoursAgo.toISOString());

      // Calculate activeLoadsChange and inTransitChange approximations
      let activeEntry = 0;
      let activeExit = 0;
      let inTransitEntry = 0;
      let inTransitExit = 0;
      recentStatusChanges?.forEach(event => {
        const match = event.description.match(/Status changed to (.+?)(:|$)/);
        if (match) {
          const newStatus = match[1].trim();
          if (activeStatuses.has(newStatus)) {
            activeEntry++;
          } else if (['delivered', 'completed', 'cancelled'].includes(newStatus)) {
            activeExit++;
          }
          if (newStatus === 'in_transit') {
            inTransitEntry++;
          } else if (['arrived_at_delivery', 'delivered', 'offloading', 'completed'].includes(newStatus)) {
            inTransitExit++;
          }
        }
      });
      const activeLoadsChange = activeEntry - activeExit;
      const inTransitChange = inTransitEntry - inTransitExit;

      // Active loads
      const { count: activeLoads } = await supabase
        .from('loads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['assigned', 'in_transit', 'arrived_at_loading', 'loading', 'arrived_at_delivery', 'offloading'] as const);

      // In transit loads
      const { count: inTransitLoads } = await supabase
        .from('loads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_transit');

      // Pending loads
      const { count: pendingLoads } = await supabase
        .from('loads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Completed today
      const { count: completedToday } = await supabase
        .from('loads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['delivered', 'completed'])
        .gte('delivered_at', todayStart.toISOString());

      // Delayed loads (ongoing loads where current time > estimated delivery)
      const { data: ongoingLoads } = await supabase
        .from('loads')
        .select('id, delivery_datetime, expected_arrival_at_delivery')
        .in('status', ['assigned', 'in_transit', 'arrived_at_loading', 'loading', 'arrived_at_delivery', 'offloading'] as const);

      const delayedLoads = ongoingLoads?.filter(load => {
        const estimatedDelivery = load.expected_arrival_at_delivery || load.delivery_datetime;
        return estimatedDelivery && new Date() > new Date(estimatedDelivery);
      }).length || 0;

      // Average delivery time and change
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { data: currentCompletedLoads } = await supabase
        .from('loads')
        .select('actual_pickup_datetime, actual_delivery_datetime')
        .in('status', ['delivered', 'completed'])
        .not('actual_pickup_datetime', 'is', null)
        .not('actual_delivery_datetime', 'is', null)
        .gte('delivered_at', sevenDaysAgo.toISOString());

      let avgDeliveryTime = 0;
      if (currentCompletedLoads && currentCompletedLoads.length > 0) {
        const totalHours = currentCompletedLoads.reduce((sum, load) => {
          const pickup = new Date(load.actual_pickup_datetime!).getTime();
          const delivery = new Date(load.actual_delivery_datetime!).getTime();
          return sum + (delivery - pickup) / (1000 * 60 * 60);
        }, 0);
        avgDeliveryTime = totalHours / currentCompletedLoads.length;
      }

      const { data: previousCompletedLoads } = await supabase
        .from('loads')
        .select('actual_pickup_datetime, actual_delivery_datetime')
        .in('status', ['delivered', 'completed'])
        .not('actual_pickup_datetime', 'is', null)
        .not('actual_delivery_datetime', 'is', null)
        .gte('delivered_at', fourteenDaysAgo.toISOString())
        .lt('delivered_at', sevenDaysAgo.toISOString());

      let previousAvgDeliveryTime = 0;
      if (previousCompletedLoads && previousCompletedLoads.length > 0) {
        const totalHours = previousCompletedLoads.reduce((sum, load) => {
          const pickup = new Date(load.actual_pickup_datetime!).getTime();
          const delivery = new Date(load.actual_delivery_datetime!).getTime();
          return sum + (delivery - pickup) / (1000 * 60 * 60);
        }, 0);
        previousAvgDeliveryTime = totalHours / previousCompletedLoads.length;
      }

      const avgDeliveryTimeChange = avgDeliveryTime - previousAvgDeliveryTime;

      // On-time delivery rate and change
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const { data: currentCompletedLoads30 } = await supabase
        .from('loads')
        .select('delivery_datetime, actual_delivery_datetime, expected_arrival_at_delivery')
        .in('status', ['delivered', 'completed'])
        .not('actual_delivery_datetime', 'is', null)
        .gte('delivered_at', thirtyDaysAgo.toISOString());

      let onTimeDeliveryRate = 0;
      if (currentCompletedLoads30 && currentCompletedLoads30.length > 0) {
        const onTimeCount = currentCompletedLoads30.filter(load => {
          const estimated = new Date(load.expected_arrival_at_delivery || load.delivery_datetime!);
          const actual = new Date(load.actual_delivery_datetime!);
          return actual <= estimated;
        }).length;
        onTimeDeliveryRate = (onTimeCount / currentCompletedLoads30.length) * 100;
      }

      const { data: previousCompletedLoads30 } = await supabase
        .from('loads')
        .select('delivery_datetime, actual_delivery_datetime, expected_arrival_at_delivery')
        .in('status', ['delivered', 'completed'])
        .not('actual_delivery_datetime', 'is', null)
        .gte('delivered_at', sixtyDaysAgo.toISOString())
        .lt('delivered_at', thirtyDaysAgo.toISOString());

      let previousOnTimeRate = 0;
      if (previousCompletedLoads30 && previousCompletedLoads30.length > 0) {
        const onTimeCount = previousCompletedLoads30.filter(load => {
          const estimated = new Date(load.expected_arrival_at_delivery || load.delivery_datetime!);
          const actual = new Date(load.actual_delivery_datetime!);
          return actual <= estimated;
        }).length;
        previousOnTimeRate = (onTimeCount / previousCompletedLoads30.length) * 100;
      }

      const onTimeDeliveryRateChange = onTimeDeliveryRate - previousOnTimeRate;

      // Total distance traveled today
      const { data: trackingData } = await supabase
        .from('delivery_tracking')
        .select('load_id, distance_traveled_km')
        .gte('recorded_at', todayStart.toISOString())
        .order('recorded_at', { ascending: false });

      // Get latest tracking entry per load
      const loadDistances = new Map();
      trackingData?.forEach(track => {
        if (!loadDistances.has(track.load_id)) {
          loadDistances.set(track.load_id, track.distance_traveled_km || 0);
        }
      });

      const totalDistanceTraveled = Array.from(loadDistances.values()).reduce((sum, dist) => sum + dist, 0);

      // Average speed from Wialon (computed outside, but included here for completeness)
      return {
        activeLoads: activeLoads || 0,
        activeLoadsChange,
        inTransitLoads: inTransitLoads || 0,
        inTransitChange,
        avgDeliveryTime,
        avgDeliveryTimeChange,
        onTimeDeliveryRate,
        onTimeDeliveryRateChange,
        pendingLoads: pendingLoads || 0,
        delayedLoads,
        completedToday: completedToday || 0,
        totalDistanceTraveled,
        avgSpeed: 0, // Placeholder, computed in component
      };
    },
    refetchInterval: refreshInterval,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('kpi-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, () => refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'delivery_tracking' }, () => refetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  if (!metrics) {
    return <div>Loading KPIs...</div>;
  }

  const TrendIndicator = ({ value, isPercentage = false }: { value: number; isPercentage?: boolean }) => {
    const formattedValue = value.toFixed(isPercentage ? 1 : 0);
    const suffix = isPercentage ? '%' : '';
    if (value > 0) {
      return <div className="flex items-center text-green-600"><TrendingUp className="h-3 w-3 mr-1" />+{formattedValue}{suffix}</div>;
    } else if (value < 0) {
      return <div className="flex items-center text-red-600"><TrendingDown className="h-3 w-3 mr-1" />{formattedValue}{suffix}</div>;
    }
    return <div className="flex items-center text-gray-600"><Minus className="h-3 w-3 mr-1" />0{suffix}</div>;
  };

  const KPICard = ({
    title,
    value,
    change,
    icon: Icon,
    suffix = '',
    colorClass = 'text-blue-600',
    isPercentage = false
  }: {
    title: string;
    value: number;
    change: number;
    icon: React.ElementType;
    suffix?: string;
    colorClass?: string;
    isPercentage?: boolean;
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${colorClass}`} />
            <div className="text-2xl font-bold">{isPercentage ? value.toFixed(1) : value.toFixed(0)}{suffix}</div>
          </div>
          <div className="text-sm">
            <TrendIndicator value={change} isPercentage={isPercentage} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Real-Time Fleet KPIs</CardTitle>
          <Badge variant="outline">Live</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Primary KPIs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Active Loads"
            value={metrics.activeLoads}
            change={metrics.activeLoadsChange}
            icon={Package}
            colorClass="text-blue-600"
          />
          <KPICard
            title="In Transit"
            value={metrics.inTransitLoads}
            change={metrics.inTransitChange}
            icon={Truck}
            colorClass="text-green-600"
          />
          <KPICard
            title="Avg Delivery Time"
            value={metrics.avgDeliveryTime}
            change={metrics.avgDeliveryTimeChange}
            icon={Clock}
            suffix="h"
            colorClass="text-purple-600"
          />
          <KPICard
            title="On-Time Rate"
            value={metrics.onTimeDeliveryRate}
            change={metrics.onTimeDeliveryRateChange}
            icon={TrendingUp}
            suffix="%"
            colorClass="text-green-600"
            isPercentage
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-yellow-600" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pendingLoads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Delayed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.delayedLoads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.completedToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Distance Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalDistanceTraveled.toFixed(0)} km</div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeKPIMonitor;
