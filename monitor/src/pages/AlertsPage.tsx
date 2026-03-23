import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Fuel, Wrench, FileText, Activity, Server,
  AlertTriangle, Clock, TrendingUp, ShieldAlert, UserX, MapPin
} from "lucide-react";
import { useTripAlertCounts } from "@/hooks/useTripAlertCounts";
import { useDieselCounts } from "@/hooks/useDieselCounts";
import { useFaultCounts } from "@/hooks/useFaultCounts";
import { useDocumentCounts } from "@/hooks/useDocumentCounts";
import { useIncidentCounts } from "@/hooks/useIncidentCounts";
import { useDriverBehaviorCounts } from "@/hooks/useDriverBehaviorCounts";
import { useGeofenceCounts } from "@/hooks/useGeofenceCounts";

const QUICK_ACTIONS = [
  {
    to: "/trip-alerts",
    icon: Truck,
    label: "Trip Alerts",
    hook: useTripAlertCounts,
    countKey: 'active' as const,
    description: "Active trip issues"
  },
  {
    to: "/diesel-alerts",
    icon: Fuel,
    label: "Diesel Debriefs",
    hook: useDieselCounts,
    countKey: 'active' as const,
    description: "Pending debrief transactions"
  },
  {
    to: "/faults",
    icon: Wrench,
    label: "Faults",
    hook: useFaultCounts,
    countKey: 'active' as const,
    description: "Vehicle faults"
  },
  {
    to: "/documents",
    icon: FileText,
    label: "Documents",
    hook: useDocumentCounts,
    countKey: 'active' as const,
    description: "Pending documents"
  },
  {
    to: "/incidents",
    icon: ShieldAlert,
    label: "Incidents",
    hook: useIncidentCounts,
    countKey: 'active' as const,
    description: "Open incidents"
  },
  {
    to: "/driver-behavior",
    icon: UserX,
    label: "Driver Behavior",
    hook: useDriverBehaviorCounts,
    countKey: 'active' as const,
    description: "Behavior events"
  },
  {
    to: "/geofence",
    icon: MapPin,
    label: "Geofence",
    hook: useGeofenceCounts,
    countKey: 'active' as const,
    description: "Zone breaches"
  },
];

export default function CommandCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, hook, countKey, description }) => {
          const { data } = hook();
          const count = data?.[countKey] ?? 0;

          return (
            <Card
              key={to}
              className="border-slate-200 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(to)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-lg bg-slate-100">
                    <Icon className="h-6 w-6 text-slate-600" />
                  </div>
                  {count > 0 && (
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-slate-200">
                      {count}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-4">{label}</h3>
                <p className="text-sm text-slate-500 mt-1">
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
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Activity stream with neutral colors */}
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-slate-400 rounded-full" />
                <span className="flex-1 text-slate-600">System operational</span>
                <span className="text-slate-400">Just now</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-slate-400 rounded-full" />
                <span className="flex-1 text-slate-600">Trip alerts updated</span>
                <span className="text-slate-400">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-slate-400 rounded-full" />
                <span className="flex-1 text-slate-600">New fault detected</span>
                <span className="text-slate-400">5 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Database</span>
              <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Realtime</span>
              <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">API</span>
              <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
                Healthy
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Last Sync</span>
              <span className="text-xs text-slate-400">30s ago</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats - Neutral colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Resolution Rate</p>
              <p className="text-xl font-semibold text-slate-900">94%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Avg Response Time</p>
              <p className="text-xl font-semibold text-slate-900">2.4m</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Open Issues</p>
              <p className="text-xl font-semibold text-slate-900">3</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}