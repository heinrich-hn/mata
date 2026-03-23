import { useAlertsBySource } from "@/hooks/useAnalytics";
import type { AlertFilters } from "@/types";

interface SourceData {
  source_label: string;
  source_type: string;
  total: number;
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
          <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-center text-slate-500 text-sm py-6">
        No source data for selected period
      </p>
    );
  }

  const maxTotal = Math.max(...data.map((d: SourceData) => d.total), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-xs text-slate-500 font-medium pb-3">Source</th>
            <th className="text-right text-xs text-slate-500 font-medium pb-3 w-20">Total</th>
            <th className="text-left text-xs text-slate-500 font-medium pb-3 w-32">Distribution</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row: SourceData) => {
            const fillPct = Math.round((row.total / maxTotal) * 100);
            return (
              <tr key={row.source_label} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex flex-col">
                    <span className="text-slate-900 font-medium">
                      {row.source_label}
                    </span>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                      {row.source_type}
                    </span>
                  </div>
                </td>
                <td className="text-right py-3 font-semibold text-slate-900">
                  {row.total}
                </td>
                <td className="py-3 pl-4">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-slate-700 h-1.5 rounded-full transition-all duration-300"
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