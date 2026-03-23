import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Filter,
  Flag,
  RefreshCw,
  Truck,
  User,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Types for trip alerts
type TripCategory = 'duplicate_pod' | 'load_exception' | 'fuel_anomaly';

interface TripAlert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'resolved';
  category: TripCategory;
  created_at: string;
  resolved_at?: string;
  resolution_comment?: string;
  resolved_by?: string;
  metadata: {
    trip_id?: string;
    trip_number?: string;
    fleet_number?: string;
    driver_name?: string;
    client_name?: string;
    issue_type?: string;
    duplicate_count?: number;
    days_in_progress?: number;
    flagged_count?: number;
    route?: string;
    revenue_amount?: number;
    expected_revenue?: number;
    is_flagged?: boolean;
    needs_review?: boolean;
    [key: string]: unknown;
  };
}

// Configuration for different alert types - no severity colors
const ALERT_TYPE_CONFIG = {
  duplicate_pod: {
    icon: AlertTriangle,
    label: "Duplicate POD",
    description: "Multiple trips with same POD number"
  },
  missing_revenue: {
    icon: DollarSign,
    label: "Missing Revenue",
    description: "Trips without base revenue set"
  },
  no_costs: {
    icon: XCircle,
    label: "No Costs",
    description: "Trips with no costs recorded"
  },
  flagged_costs: {
    icon: Flag,
    label: "Flagged Costs",
    description: "Costs flagged for investigation"
  },
};

export default function TripAlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("duplicate_pod");
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trip-alerts'],
    queryFn: async () => {
      // Fetch trip-related alerts (both active and resolved) — paginate to get all
      let allAlerts: TripAlert[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .in('category', ['duplicate_pod', 'load_exception', 'fuel_anomaly'])
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allAlerts = [...allAlerts, ...(data as TripAlert[])];
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Filter out any remaining fuel-related alerts by issue_type
      return allAlerts.filter(alert => {
        const issueType = alert.metadata?.issue_type as string;
        const fuelIssueTypes = ['low_efficiency', 'probe_discrepancy', 'missing_debrief', 'high_consumption'];

        if (fuelIssueTypes.includes(issueType)) {
          return false;
        }

        return true;
      });
    },
    refetchInterval: 30000,
  });

  // Real-time subscription for alert updates
  useEffect(() => {
    const subscription = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip-alerts'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Only count active alerts for tab badges
  const activeAlerts = alerts.filter(a => a.status === 'active');

  // Group alerts by type (show all for browsing, count only active for badges)
  const groupedAlerts = {
    duplicate_pod: alerts.filter(a => a.metadata?.issue_type === 'duplicate_pod' || a.category === 'duplicate_pod'),
    missing_revenue: alerts.filter(a => a.metadata?.issue_type === 'missing_revenue'),
    no_costs: alerts.filter(a => a.metadata?.issue_type === 'no_costs'),
    flagged_costs: alerts.filter(a => a.metadata?.issue_type === 'flagged_costs'),
  };

  const activeCounts = {
    duplicate_pod: activeAlerts.filter(a => a.metadata?.issue_type === 'duplicate_pod' || a.category === 'duplicate_pod').length,
    missing_revenue: activeAlerts.filter(a => a.metadata?.issue_type === 'missing_revenue').length,
    no_costs: activeAlerts.filter(a => a.metadata?.issue_type === 'no_costs').length,
    flagged_costs: activeAlerts.filter(a => a.metadata?.issue_type === 'flagged_costs').length,
  };

  // Filter by search and sort active first
  const filteredAlerts = groupedAlerts[activeTab as keyof typeof groupedAlerts]?.filter(alert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      alert.title.toLowerCase().includes(query) ||
      alert.message.toLowerCase().includes(query) ||
      alert.metadata?.trip_number?.toLowerCase().includes(query) ||
      alert.metadata?.fleet_number?.toLowerCase().includes(query) ||
      alert.metadata?.driver_name?.toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    // Active alerts first, resolved last
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getAlertConfig = (alert: TripAlert) => {
    const issueType = alert.metadata?.issue_type as string;
    if (issueType && issueType in ALERT_TYPE_CONFIG) {
      return ALERT_TYPE_CONFIG[issueType as keyof typeof ALERT_TYPE_CONFIG];
    }
    if (alert.category === 'duplicate_pod') return ALERT_TYPE_CONFIG.duplicate_pod;
    if (alert.category === 'fuel_anomaly') return ALERT_TYPE_CONFIG.flagged_costs;
    return ALERT_TYPE_CONFIG.no_costs;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading trip alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Search and Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by trip, fleet, or driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-sm border-slate-200 focus:ring-slate-400"
          />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="h-9 px-3 border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-1 bg-slate-100 border border-slate-200">
          <TabsTrigger value="duplicate_pod" className="text-xs px-3 py-1.5 h-auto data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Duplicate ({activeCounts.duplicate_pod})
          </TabsTrigger>
          <TabsTrigger value="missing_revenue" className="text-xs px-3 py-1.5 h-auto data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Revenue ({activeCounts.missing_revenue})
          </TabsTrigger>
          <TabsTrigger value="no_costs" className="text-xs px-3 py-1.5 h-auto data-[state=active]:bg-white data-[state=active]:text-slate-900">
            No Costs ({activeCounts.no_costs})
          </TabsTrigger>
          <TabsTrigger value="flagged_costs" className="text-xs px-3 py-1.5 h-auto data-[state=active]:bg-white data-[state=active]:text-slate-900">
            Flagged ({activeCounts.flagged_costs})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {filteredAlerts?.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-12 w-12 text-slate-300" />
                  <p className="text-slate-500 text-sm">No alerts in this category</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts?.map((alert) => {
              const config = getAlertConfig(alert);
              const Icon = config.icon;
              const isResolved = alert.status === 'resolved';

              return (
                <Link
                  key={alert.id}
                  to={`/alerts/${alert.id}`}
                  className="block"
                >
                  <Card className={cn(
                    "border-slate-200 hover:shadow-md transition-shadow duration-200 cursor-pointer",
                    isResolved && "opacity-50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isResolved ? "bg-emerald-50" : "bg-slate-100"
                        )}>
                          {isResolved
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <Icon className="h-4 w-4 text-slate-600" />
                          }
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">
                              {alert.title}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mb-2">
                            {alert.metadata?.trip_number && (
                              <span className="font-medium text-slate-700 mr-1">
                                Trip #{alert.metadata.trip_number}
                              </span>
                            )}
                            {alert.message}
                          </p>

                          {/* Metadata row */}
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {alert.metadata?.fleet_number && (
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {alert.metadata.fleet_number}
                              </span>
                            )}
                            {alert.metadata?.driver_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {alert.metadata.driver_name.split(' ')[0]}
                              </span>
                            )}
                            {alert.metadata?.duplicate_count && (
                              <span>
                                {alert.metadata.duplicate_count}x duplicate
                              </span>
                            )}
                            {alert.metadata?.flagged_count && (
                              <span>
                                {alert.metadata.flagged_count} flagged
                              </span>
                            )}
                          </div>

                          {/* Time */}
                          <div className="mt-2">
                            <span className="text-xs text-slate-400">
                              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}