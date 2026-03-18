import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useDailyAlertTrend } from "@/hooks/useAnalytics";

export default function DailyBarChart() {
  const { data, isLoading } = useDailyAlertTrend();

  if (isLoading) {
    return <div className="h-48 bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 22%)" />
        <XAxis
          dataKey="day"
          tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
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
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => (
            <span style={{ color: "hsl(215 20% 65%)" }}>{value}</span>
          )}
        />
        <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
        <Bar dataKey="high"     name="High"     stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
        <Bar dataKey="medium"   name="Medium"   stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
