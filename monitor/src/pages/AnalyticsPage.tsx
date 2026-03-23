import AlertFilterBar from "@/components/alerts/AlertFilterBar";
import AlertCategoryChart from "@/components/analytics/AlertCategoryChart";
import AlertsBySourceTable from "@/components/analytics/AlertsBySourceTable";
import AlertTrendChart from "@/components/analytics/AlertTrendChart";
import DailyBarChart from "@/components/analytics/DailyBarChart";
import KPIScorecard from "@/components/analytics/KPIScorecard";
import { useAlertFilters } from "@/hooks/useAlertFilters";

export default function AnalyticsPage() {
  const filterState = useAlertFilters();
  const { filters } = filterState;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50">
      <div className="px-8 py-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <AlertFilterBar {...filterState} />
        </div>

        {/* KPI Scorecard */}
        <KPIScorecard filters={filters} />

        {/* Charts row 1: Trend + Category */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Alert Volume Trend
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Time-series analysis of total alert volume</p>
            </div>
            <div className="p-5">
              <AlertTrendChart filters={filters} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Category Distribution
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown by alert classification</p>
            </div>
            <div className="p-5">
              <AlertCategoryChart filters={filters} />
            </div>
          </div>
        </div>

        {/* Charts row 2: Daily bar + Source table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Daily Alert Volume
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days total volume</p>
            </div>
            <div className="p-5">
              <DailyBarChart />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Top Alert Sources
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Highest volume alert sources</p>
            </div>
            <div className="overflow-x-auto">
              <AlertsBySourceTable filters={filters} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}