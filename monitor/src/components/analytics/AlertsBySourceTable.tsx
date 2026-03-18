import { Truck, User, Wrench, Fuel, MapPin, Server, Package, AlertCircle } from "lucide-react";
import { useAlertsBySource } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  vehicle: Truck, driver: User, maintenance: Wrench, fuel: Fuel,
  geofence: MapPin, system: Server, load: Package, tyre: AlertCircle,
  trip: MapPin, manual: AlertCircle,
};

interface SourceData {
  source_label: string;
  source_type: string;
  total: number;
  active: number;
}

interface AlertsBySourceTableProps {
  filters: AlertFilters;
}

export default function AlertsBySourceTable({ filters }: AlertsBySourceTableProps) {
  const { data, isLoading } = useAlertsBySource(filters);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-6">
        No source data for selected period
      </p>
    );
  }

  const maxTotal = Math.max(...data.map((d: SourceData) => d.total), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-4">Source</th>
            <th className="text-right text-xs text-muted-foreground font-medium pb-2 px-3 w-16">Active</th>
            <th className="text-right text-xs text-muted-foreground font-medium pb-2 px-3 w-16">Total</th>
            <th className="text-left text-xs text-muted-foreground font-medium pb-2 pl-4 w-32">Activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row: SourceData) => {
            const Icon = SOURCE_ICONS[row.source_type] ?? AlertCircle;
            const fillPct = Math.round((row.total / maxTotal) * 100);
            return (
              <tr key={row.source_label} className="hover:bg-accent/50 transition-colors">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground font-medium truncate max-w-[150px]">
                      {row.source_label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{row.source_type}</span>
                  </div>
                </td>
                <td className="text-right py-2.5 px-3 font-semibold text-foreground">{row.active || 0}</td>
                <td className="text-right py-2.5 px-3 text-muted-foreground">{row.total}</td>
                <td className="py-2.5 pl-4">
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}