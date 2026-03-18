import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Fuel, Wrench, FileText, Activity, Server,
  AlertTriangle, Clock, TrendingUp
} from "lucide-react";
import { useTripAlertCounts } from "@/hooks/useTripAlertCounts";
import { useDieselCounts } from "@/hooks/useDieselCounts";
import { useFaultCounts } from "@/hooks/useFaultCounts";
import { useDocumentCounts } from "@/hooks/useDocumentCounts";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    to: "/trip-alerts",
    icon: Truck,
    label: "Trip Alerts",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    hook: useTripAlertCounts,
    countKey: 'active' as const,
    description: "Active trip issues"
  },
  {
    to: "/diesel-alerts",
    icon: Fuel,
    label: "Diesel Alerts",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    hook: useDieselCounts,
    countKey: 'active' as const,
    description: "Fuel anomalies"
  },
  {
    to: "/faults",
    icon: Wrench,
    label: "Faults",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    hook: useFaultCounts,
    countKey: 'active' as const,
    description: "Vehicle faults"
  },
  {
    to: "/documents",
    icon: FileText,
    label: "Documents",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    hook: useDocumentCounts,
    countKey: 'active' as const,
    description: "Pending documents"
  },
];

export default function CommandCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational overview and quick actions
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, color, bgColor, hook, countKey, description }) => {
          const { data } = hook();
          const count = data?.[countKey] ?? 0;

          return (
            <Card
              key={to}
              className="hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate(to)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={cn("p-3 rounded-lg", bgColor)}>
                    <Icon className={cn("h-6 w-6", color)} />
                  </div>
                  {count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {count} active
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-4">{label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
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
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* You can add a real-time activity stream here */}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="flex-1">System operational</span>
                <span className="text-muted-foreground">Just now</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="flex-1">Trip alerts updated</span>
                <span className="text-muted-foreground">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="flex-1">New fault detected</span>
                <span className="text-muted-foreground">5 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Realtime</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">API</span>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Healthy
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Last Sync</span>
              <span className="text-xs text-muted-foreground">30s ago</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary/60" />
            <div>
              <p className="text-xs text-muted-foreground">Resolution Rate</p>
              <p className="text-xl font-semibold">94%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary/60" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Response Time</p>
              <p className="text-xl font-semibold">2.4m</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-primary/60" />
            <div>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
              <p className="text-xl font-semibold">3</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}