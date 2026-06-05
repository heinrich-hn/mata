import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Fuel, Wrench, FileText, Activity, Server,
  AlertTriangle, Clock, TrendingUp, ShieldAlert, UserX
} from "lucide-react";
import { useTripAlertCounts } from "@/hooks/useTripAlertCounts";
import { useDieselCounts } from "@/hooks/useDieselCounts";
import { useFaultCounts } from "@/hooks/useFaultCounts";
import { useDocumentCounts } from "@/hooks/useDocumentCounts";
import { useIncidentCounts } from "@/hooks/useIncidentCounts";
import { useDriverBehaviorCounts } from "@/hooks/useDriverBehaviorCounts";

const QUICK_ACTIONS = [
  {
    to: "/trip-alerts",
    icon: Truck,
    label: "Trip Alerts",
    hook: useTripAlertCounts,
    countKey: 'active' as const,
    description: "Active trip issues",
  },
  {
    to: "/diesel-alerts",
    icon: Fuel,
    label: "Diesel Debriefs",
    hook: useDieselCounts,
    countKey: 'active' as const,
    description: "Pending debrief transactions",
  },
  {
    to: "/faults",
    icon: Wrench,
    label: "Faults",
    hook: useFaultCounts,
    countKey: 'active' as const,
    description: "Vehicle faults",
  },
  {
    to: "/documents",
    icon: FileText,
    label: "Documents",
    hook: useDocumentCounts,
    countKey: 'active' as const,
    description: "Pending documents",
  },
  {
    to: "/incidents",
    icon: ShieldAlert,
    label: "Incidents",
    hook: useIncidentCounts,
    countKey: 'active' as const,
    description: "Open incidents",
  },
  {
    to: "/driver-behavior",
    icon: UserX,
    label: "Driver Behavior",
    hook: useDriverBehaviorCounts,
    countKey: 'active' as const,
    description: "Behavior events",
  },
];

export default function CommandCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="monitor-page">
      {/* Page header */}
      <div>
        <h1 className="page-title text-2xl text-foreground">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Fleet operations overview</p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, hook, countKey, description }) => {
          const { data } = hook();
          const count = data?.[countKey] ?? 0;

          return (
            <Card
              key={to}
              className="hover-lift cursor-pointer group"
              onClick={() => navigate(to)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[0.6875rem]">
                      {count}
                    </Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground mt-3">{label}</h3>
                <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
                  {count > 0 ? `${count} ${description}` : `No active ${description.toLowerCase()}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-success rounded-full flex-shrink-0" />
                <span className="flex-1 text-foreground text-[0.8125rem]">System operational</span>
                <span className="text-xs text-muted-foreground">Just now</span>
              </div>
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-info rounded-full flex-shrink-0" />
                <span className="flex-1 text-foreground text-[0.8125rem]">Trip alerts updated</span>
                <span className="text-xs text-muted-foreground">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-danger rounded-full flex-shrink-0" />
                <span className="flex-1 text-foreground text-[0.8125rem]">New fault detected</span>
                <span className="text-xs text-muted-foreground">5 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-foreground">Database</span>
              <Badge variant="success">Operational</Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-foreground">Realtime</span>
              <Badge variant="info">Connected</Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-foreground">API</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-foreground">Last Sync</span>
              <span className="text-xs text-muted-foreground font-medium">30s ago</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded bg-success-soft text-success">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resolution Rate</p>
              <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">94%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded bg-info-soft text-info">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Avg Response Time</p>
              <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">2.4m</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Open Issues</p>
              <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">3</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}