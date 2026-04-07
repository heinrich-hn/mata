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
];

export default function CommandCenterPage() {
  const navigate = useNavigate();

  return (
    <div className="monitor-page">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Fleet operations overview</p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, hook, countKey, description, cardClass, iconClass, badgeClass }) => {
          const { data } = hook();
          const count = data?.[countKey] ?? 0;

          return (
            <Card
              key={to}
              className={`border bg-gradient-to-br hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group ${cardClass}`}
              onClick={() => navigate(to)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {count > 0 && (
                    <Badge className={`text-[0.6875rem] ${badgeClass}`}>
                      {count}
                    </Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mt-3">{label}</h3>
                <p className="text-[0.8125rem] text-slate-500 mt-0.5">
                  {count > 0 ? `${count} ${description}` : `No active ${description.toLowerCase()}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                <span className="flex-1 text-slate-600 text-[0.8125rem]">System operational</span>
                <span className="text-xs text-slate-400">Just now</span>
              </div>
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                <span className="flex-1 text-slate-600 text-[0.8125rem]">Trip alerts updated</span>
                <span className="text-xs text-slate-400">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm py-1">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                <span className="flex-1 text-slate-600 text-[0.8125rem]">New fault detected</span>
                <span className="text-xs text-slate-400">5 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Server className="h-3.5 w-3.5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-slate-600">Database</span>
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-slate-600">Realtime</span>
              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-slate-600">API</span>
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                Healthy
              </Badge>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[0.8125rem] text-slate-600">Last Sync</span>
              <span className="text-xs text-slate-400 font-medium">30s ago</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-100">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Resolution Rate</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">94%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/40 to-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Avg Response Time</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">2.4m</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50/40 to-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-rose-100">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Open Issues</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">3</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}