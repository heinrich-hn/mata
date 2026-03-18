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
  color?: string;
  isLoading?: boolean;
}

function KPICard({ label, value, unit, trend, sublabel, color = "text-foreground", isLoading }: KPICardProps) {
  const TrendIcon = !trend ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = !trend ? "text-muted-foreground" : trend > 0 ? "text-red-400" : "text-green-400";

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      {isLoading ? (
        <div className="h-8 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-end gap-1">
          <span className={cn("text-3xl font-bold leading-tight", color)}>{value}</span>
          {unit && <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>}
        </div>
      )}
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
      {typeof trend !== "undefined" && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          {Math.abs(trend)}% vs prev period
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Active Alerts"
        value={kpis?.activeAlerts ?? 0}
        sublabel="need attention"
        color="text-foreground"
        isLoading={isLoading}
      />
      <KPICard
        label="Total Alerts"
        value={kpis?.totalAlerts ?? 0}
        trend={kpis?.alertsTrend}
        sublabel="in selected period"
        isLoading={isLoading}
      />
      <KPICard
        label="Resolved"
        value={kpis?.resolvedAlerts ?? 0}
        sublabel="in selected period"
        color="text-green-400"
        isLoading={isLoading}
      />
      <KPICard
        label="Resolution Rate"
        value={kpis?.resolutionRate ?? 0}
        unit="%"
        sublabel="of total alerts"
        color={
          (kpis?.resolutionRate ?? 0) >= 80 ? "text-green-400" :
            (kpis?.resolutionRate ?? 0) >= 50 ? "text-amber-400" : "text-red-400"
        }
        isLoading={isLoading}
      />
    </div>
  );
}