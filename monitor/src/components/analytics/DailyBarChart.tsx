import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useDailyAlertTrend } from "@/hooks/useAnalytics";

export default function DailyBarChart() {
  const { data, isLoading } = useDailyAlertTrend();

  if (isLoading) {
    return <div className="h-48 bg-slate-100 animate-pulse rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
        No daily data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c3e50" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#2c3e50" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="day"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
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
          formatter={(value: number) => [`${value} alert${value !== 1 ? "s" : ""}`, 'Total']}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />
        <Bar 
          dataKey="total" 
          name="Total Alerts"
          fill="url(#bar-gradient)"
          radius={[4, 4, 0, 0]}
          maxBarSize={60}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}