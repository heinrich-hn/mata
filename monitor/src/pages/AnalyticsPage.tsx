import AlertFilterBar from "@/components/alerts/AlertFilterBar";
import AlertCategoryChart from "@/components/analytics/AlertCategoryChart";
import AlertsBySourceTable from "@/components/analytics/AlertsBySourceTable";
import AlertTrendChart from "@/components/analytics/AlertTrendChart";
import DailyBarChart from "@/components/analytics/DailyBarChart";
import KPIScorecard from "@/components/analytics/KPIScorecard";
import { useAlertFilters } from "@/hooks/useAlertFilters";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const filterState = useAlertFilters();
  const { filters } = filterState;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-8 space-y-6 max-w-7xl mx-auto">
        {/* Professional Page Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor alert trends and performance metrics</p>
          </div>
        </div>

        {/* Filters */}
        <AlertFilterBar {...filterState} />

        {/* KPI Scorecard */}
        <KPIScorecard filters={filters} />

        {/* Charts row 1: Trend + Category */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alert trend (wider) */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">
              Alert Volume Over Time
            </h2>
            <AlertTrendChart filters={filters} />
          </div>

          {/* Category breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">
              Alerts by Category
            </h2>
            <AlertCategoryChart filters={filters} />
          </div>
        </div>

        {/* Charts row 2: Daily bar + Source table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 7-day stacked bar */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">
              Last 7 Days — Alerts by Severity
            </h2>
            <DailyBarChart />
          </div>

          {/* Top sources table */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">
              Top Alert Sources
            </h2>
            <AlertsBySourceTable filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
}
