import { Badge } from "@/components/ui/badge";
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
  Clock,
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

// Types for trip alerts - ONLY active and resolved statuses
type TripCategory = 'duplicate_pod' | 'load_exception' | 'trip_delay';

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

// Configuration for different alert types
const ALERT_TYPE_CONFIG = {
  duplicate_pod: {
    icon: AlertTriangle,
    color: "text-severity-medium",
    bgColor: "bg-severity-medium/10",
    label: "Duplicate POD",
    description: "Multiple trips with same POD number"
  },
  missing_revenue: {
    icon: DollarSign,
    color: "text-severity-medium",
    bgColor: "bg-severity-medium/10",
    label: "Missing Revenue",
    description: "Trips without base revenue set"
  },
  no_costs: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "No Costs",
    description: "Trips with no costs recorded"
  },
  flagged_costs: {
    icon: Flag,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Flagged Costs",
    description: "Costs flagged for investigation"
  },
  long_running: {
    icon: Clock,
    color: "text-severity-high",
    bgColor: "bg-severity-high/10",
    label: "Long Running",
    description: "Trips in progress for over 14 days"
  },
  flagged_trip: {
    icon: Flag,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Flagged Trip",
    description: "Trips marked for review"
  }
};

/* Professional severity colors */
const SEVERITY_COLORS = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-severity-high/10 text-severity-high border-severity-high/20",
  medium: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
  low: "bg-severity-low/10 text-severity-low border-severity-low/20",
  info: "bg-muted text-muted-foreground border-border",
};

export default function TripAlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("duplicate_pod");
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['trip-alerts'],
    queryFn: async () => {
      // Fetch ONLY active trip-related alerts
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .in('category', ['duplicate_pod', 'load_exception', 'trip_delay'])
        .eq('status', 'active') // Only fetch active alerts
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out any remaining fuel-related alerts by issue_type
      return (data as TripAlert[]).filter(alert => {
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
          // Refetch alerts when any change occurs
          queryClient.invalidateQueries({ queryKey: ['trip-alerts'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Group alerts by type
  const groupedAlerts = {
    duplicate_pod: alerts.filter(a => a.metadata?.issue_type === 'duplicate_pod' || a.category === 'duplicate_pod'),
    missing_revenue: alerts.filter(a => a.metadata?.issue_type === 'missing_revenue'),
    no_costs: alerts.filter(a => a.metadata?.issue_type === 'no_costs'),
    flagged_trip: alerts.filter(a => a.metadata?.is_flagged === true || a.metadata?.needs_review === true),
  };

  // Filter by search
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
  });

  const getAlertConfig = (alert: TripAlert) => {
    const issueType = alert.metadata?.issue_type as string;
    if (issueType && issueType in ALERT_TYPE_CONFIG) {
      return ALERT_TYPE_CONFIG[issueType as keyof typeof ALERT_TYPE_CONFIG];
    }
    if (alert.category === 'duplicate_pod') return ALERT_TYPE_CONFIG.duplicate_pod;
    if (alert.category === 'trip_delay') return ALERT_TYPE_CONFIG.long_running;
    return ALERT_TYPE_CONFIG.flagged_trip;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading trip alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Active Trip Alerts</h1>
            <p className="text-xs text-muted-foreground">
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''} need attention
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="h-8 px-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search alerts by trip, fleet, or driver..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-1">
          <TabsTrigger value="duplicate_pod" className="text-xs px-2 py-1 h-7">
            Duplicate ({groupedAlerts.duplicate_pod.length})
          </TabsTrigger>
          <TabsTrigger value="missing_revenue" className="text-xs px-2 py-1 h-7">
            Revenue ({groupedAlerts.missing_revenue.length})
          </TabsTrigger>
          <TabsTrigger value="no_costs" className="text-xs px-2 py-1 h-7">
            No Costs ({groupedAlerts.no_costs.length})
          </TabsTrigger>
          <TabsTrigger value="flagged_trip" className="text-xs px-2 py-1 h-7">
            Flagged ({groupedAlerts.flagged_trip.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-3 space-y-2">
          {filteredAlerts?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p>No active alerts in this category</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts?.map((alert) => {
              const config = getAlertConfig(alert);
              const Icon = config.icon;

              return (
                <Link
                  key={alert.id}
                  to={`/trips/${alert.metadata?.trip_id}`}
                  className="block"
                >
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        {/* Icon */}
                        <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0", config.bgColor)}>
                          <Icon className={cn("h-3.5 w-3.5", config.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium truncate">{alert.title}</span>
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                              ACTIVE
                            </Badge>
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {alert.metadata?.trip_number && (
                              <span className="font-medium text-foreground mr-1">
                                #{alert.metadata.trip_number}
                              </span>
                            )}
                            {alert.message}
                          </p>

                          {/* Compact metadata */}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            {alert.metadata?.fleet_number && (
                              <span className="flex items-center gap-0.5">
                                <Truck className="h-2.5 w-2.5" />
                                {alert.metadata.fleet_number}
                              </span>
                            )}
                            {alert.metadata?.driver_name && (
                              <span className="flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" />
                                {alert.metadata.driver_name.split(' ')[0]}
                              </span>
                            )}
                            {alert.metadata?.duplicate_count && (
                              <span className="text-amber-600">
                                {alert.metadata.duplicate_count}x duplicate
                              </span>
                            )}
                            {alert.metadata?.days_in_progress && (
                              <span className="text-orange-600">
                                {alert.metadata.days_in_progress}d
                              </span>
                            )}
                            {alert.metadata?.flagged_count && (
                              <span className="text-red-600">
                                {alert.metadata.flagged_count} flagged
                              </span>
                            )}
                          </div>

                          {/* Time and Severity */}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                            </span>
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", SEVERITY_COLORS[alert.severity])}>
                              {alert.severity}
                            </Badge>
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