import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAlertTrend } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

interface AlertTrendChartProps {
  filters: AlertFilters;
}

const COLOR = "#3b82f6"; // Single blue color for all alerts

export default function AlertTrendChart({ filters }: AlertTrendChartProps) {
  const { data, isLoading } = useAlertTrend(filters);

  if (isLoading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No data for selected period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-alerts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 22%)" />
        <XAxis
          dataKey="period"
          tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(222 47% 14%)",
            border: "1px solid hsl(222 47% 22%)",
            borderRadius: "8px",
            color: "hsl(213 31% 91%)",
            fontSize: 12,
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