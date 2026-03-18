import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useAlertsByCategory } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

interface AlertCategoryChartProps {
  filters: AlertFilters;
}

export default function AlertCategoryChart({ filters }: AlertCategoryChartProps) {
  const { data, isLoading } = useAlertsByCategory(filters);

  if (isLoading) {
    return <div className="h-64 bg-muted animate-pulse rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No category data for selected period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(222 47% 14%)",
            border: "1px solid hsl(222 47% 22%)",
            borderRadius: "8px",
            color: "hsl(213 31% 91%)",
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} alert${value !== 1 ? "s" : ""}`, 'Count']}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "hsl(215 20% 65%)", fontSize: 11 }}>{value}</span>
          )}
          iconType="circle"
          iconSize={8}
          layout="vertical"
          align="right"
          verticalAlign="middle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}