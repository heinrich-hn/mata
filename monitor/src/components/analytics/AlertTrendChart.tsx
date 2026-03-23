import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAlertTrend } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

interface AlertTrendChartProps {
  filters: AlertFilters;
}

const COLOR = "#2c3e50"; // Professional dark slate color

export default function AlertTrendChart({ filters }: AlertTrendChartProps) {
  const { data, isLoading } = useAlertTrend(filters);

  if (isLoading) {
    return <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        No data for selected period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-alerts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLOR} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLOR} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="period"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            color: "#0f172a",
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number) => [`${value} alert${value !== 1 ? "s" : ""}`, 'Count']}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Total Alerts"
          stroke={COLOR}
          strokeWidth={2}
          fill="url(#grad-alerts)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}