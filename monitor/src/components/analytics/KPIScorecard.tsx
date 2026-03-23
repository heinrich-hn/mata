import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKPISummary } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  sublabel?: string;
  isLoading?: boolean;
}

function KPICard({ label, value, unit, trend, sublabel, isLoading }: KPICardProps) {
  const TrendIcon = !trend ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = !trend ? "text-slate-400" : trend > 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow duration-200">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      {isLoading ? (
        <div className="h-8 bg-slate-100 animate-pulse rounded" />
      ) : (
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold leading-tight text-slate-900">{value}</span>
          {unit && <span className="text-sm text-slate-400 mb-0.5">{unit}</span>}
        </div>
      )}
      {sublabel && (
        <p className="text-xs text-slate-400">{sublabel}</p>
      )}
      {typeof trend !== "undefined" && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          {Math.abs(trend)}% vs previous period
        </div>
      )}
    </div>
  );
}

interface KPIScorecardProps {
  filters: AlertFilters;
}

export default function KPIScorecard({ filters }: KPIScorecardProps) {
  const { data: kpis, isLoading } = useKPISummary(filters);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      <KPICard
        label="Total Alerts"
        value={kpis?.totalAlerts ?? 0}
        trend={kpis?.alertsTrend}
        sublabel="in selected period"
        isLoading={isLoading}
      />
      <KPICard
        label="Alert Volume"
        value={kpis?.totalAlerts ?? 0}
        sublabel="total events"
        isLoading={isLoading}
      />
      <KPICard
        label="Alert Rate"
        value={kpis?.totalAlerts ? Math.round(kpis.totalAlerts / 30) : 0}
        unit="/day"
        sublabel="daily average"
        isLoading={isLoading}
      />
      <KPICard
        label="Peak Period"
        value={kpis?.alertsTrend ? (kpis.alertsTrend > 0 ? "↑ Increasing" : "↓ Decreasing") : "→ Stable"}
        sublabel="trend direction"
        isLoading={isLoading}
      />
    </div>
  );
}