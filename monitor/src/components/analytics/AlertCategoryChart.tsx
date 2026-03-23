import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useAlertsByCategory } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

// Professional, muted color palette without severity connotations
const PROFESSIONAL_COLORS = [
  "#2c3e50", // Dark slate
  "#34495e", // Slate
  "#5d6d7e", // Gray blue
  "#7f8c8d", // Gray
  "#95a5a6", // Light gray
  "#bdc3c7", // Silver
  "#4a627a", // Steel blue
  "#6c7a89", // Blue gray
];

interface AlertCategoryChartProps {
  filters: AlertFilters;
}

export default function AlertCategoryChart({ filters }: AlertCategoryChartProps) {
  const { data, isLoading } = useAlertsByCategory(filters);

  if (isLoading) {
    return <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
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
          {data.map((_, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length]} 
              stroke="white"
              strokeWidth={2}
            />
          ))}
        </Pie>
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
          formatter={(value: number) => [`${value} alert${value !== 1 ? "s" : ""}`, 'Count']}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 500 }}>
              {value}
            </span>
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