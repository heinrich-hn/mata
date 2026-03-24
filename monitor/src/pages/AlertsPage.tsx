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
    description: "Active trip issues",
    cardClass: "border-blue-200/80 from-blue-50/55 to-white",
    iconClass: "bg-blue-100 text-blue-700",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    to: "/diesel-alerts",
    icon: Fuel,
    label: "Diesel Debriefs",
    hook: useDieselCounts,
    countKey: 'active' as const,
    description: "Pending debrief transactions",
    cardClass: "border-amber-200/80 from-amber-50/55 to-white",
    iconClass: "bg-amber-100 text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    to: "/faults",
    icon: Wrench,
    label: "Faults",
    hook: useFaultCounts,
    countKey: 'active' as const,
    description: "Vehicle faults",
    cardClass: "border-rose-200/80 from-rose-50/55 to-white",
    iconClass: "bg-rose-100 text-rose-700",
    badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
  },
  {
    to: "/documents",
    icon: FileText,
    label: "Documents",
    hook: useDocumentCounts,
    countKey: 'active' as const,
    description: "Pending documents",
    cardClass: "border-emerald-200/80 from-emerald-50/55 to-white",
    iconClass: "bg-emerald-100 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    to: "/incidents",
    icon: ShieldAlert,
    label: "Incidents",
    hook: useIncidentCounts,
    countKey: 'active' as const,
    description: "Open incidents",
    cardClass: "border-rose-200/80 from-rose-50/55 to-white",
    iconClass: "bg-rose-100 text-rose-700",
    badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
  },
  {
    to: "/driver-behavior",
    icon: UserX,
    label: "Driver Behavior",
    hook: useDriverBehaviorCounts,
    countKey: 'active' as const,
    description: "Behavior events",
    cardClass: "border-violet-200/80 from-violet-50/55 to-white",
    iconClass: "bg-violet-100 text-violet-700",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200",
  },
  {
    to: "/geofence",
    icon: MapPin,
    label: "Geofence",
    hook: useGeofenceCounts,
    countKey: 'active' as const,
    description: "Zone breaches",
    cardClass: "border-cyan-200/80 from-cyan-50/55 to-white",
    iconClass: "bg-cyan-100 text-cyan-700",
    badgeClass: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
];

export default function CommandCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="monitor-page">
      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, hook, countKey, description, cardClass, iconClass, badgeClass }) => {
          const { data } = hook();
          const count = data?.[countKey] ?? 0;

          return (
            <Card
              key={to}
              className={`border bg-gradient-to-br hover:shadow-md transition-all cursor-pointer group ${cardClass}`}
              onClick={() => navigate(to)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${iconClass}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  {count > 0 && (
                    <Badge className={`text-xs ${badgeClass}`}>
                      {count}
                    </Badge>
                  )}
                </div>
                <h3 className="text-base font-medium text-slate-900 mt-4">{label}</h3>
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
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="flex-1 text-slate-600">System operational</span>
                <span className="text-slate-400">Just now</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="flex-1 text-slate-600">Trip alerts updated</span>
                <span className="text-slate-400">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-rose-500 rounded-full" />
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
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Realtime</span>
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">API</span>
              <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
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
        <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/55 to-white">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Resolution Rate</p>
              <p className="text-xl font-bold text-slate-900">94%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200/80 bg-gradient-to-br from-blue-50/55 to-white">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Avg Response Time</p>
              <p className="text-xl font-bold text-slate-900">2.4m</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200/80 bg-gradient-to-br from-rose-50/55 to-white">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-rose-600" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Open Issues</p>
              <p className="text-xl font-bold text-slate-900">3</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}