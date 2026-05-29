import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, DollarSign, ListTodo, Package, TrendingUp, Wrench } from "lucide-react";

interface PartsRequest {
  status: string;
  total_price?: number | null;
  is_from_inventory?: boolean | null;
  is_service?: boolean | null;
}

interface JobCardStatsProps {
  tasks: { status: string }[];
  laborEntries: { total_cost: number; hours_worked?: number }[];
  parts: PartsRequest[];
}

const JobCardStats = ({ tasks, laborEntries, parts }: JobCardStatsProps) => {
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Calculate labor costs and hours
  const totalLaborCost = laborEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0);
  const totalLaborHours = laborEntries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0);

  // Calculate parts costs by category (exclude cancelled and rejected)
  const activeParts = parts.filter(p => p.status !== "cancelled" && p.status !== "rejected");
  const partsMaterialsCost = activeParts
    .filter(p => !p.is_service)
    .reduce((sum, p) => sum + (p.total_price || 0), 0);
  const servicesCost = activeParts
    .filter(p => p.is_service)
    .reduce((sum, p) => sum + (p.total_price || 0), 0);

  // Grand total
  const grandTotal = partsMaterialsCost + servicesCost + totalLaborCost;

  const stats = [
    {
      icon: TrendingUp,
      label: "Grand Total",
      value: `$${grandTotal.toFixed(2)}`,
      subtext: "Parts + Labor",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      iconBg: "bg-emerald-100",
      ring: "ring-emerald-100",
      progress: null as number | null,
    },
    {
      icon: Package,
      label: "Parts & Materials",
      value: `$${partsMaterialsCost.toFixed(2)}`,
      subtext: `${activeParts.filter(p => !p.is_service).length} items`,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      iconBg: "bg-blue-100",
      ring: "ring-blue-100",
      progress: null as number | null,
    },
    {
      icon: Wrench,
      label: "Services",
      value: `$${servicesCost.toFixed(2)}`,
      subtext: `${activeParts.filter(p => p.is_service).length} services`,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      iconBg: "bg-purple-100",
      ring: "ring-purple-100",
      progress: null as number | null,
    },
    {
      icon: DollarSign,
      label: "Labor",
      value: `$${totalLaborCost.toFixed(2)}`,
      subtext: `${totalLaborHours.toFixed(1)}h total`,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      iconBg: "bg-orange-100",
      ring: "ring-orange-100",
      progress: null as number | null,
    },
    {
      icon: ListTodo,
      label: "Tasks",
      value: `${completedTasks}/${totalTasks}`,
      subtext: `${taskProgress.toFixed(0)}% complete`,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      iconBg: "bg-slate-200",
      ring: "ring-slate-100",
      progress: taskProgress,
    },
    {
      icon: CheckCircle2,
      label: "Progress",
      value: `${taskProgress.toFixed(0)}%`,
      subtext: taskProgress === 100 ? "Ready to close" : "In progress",
      color: taskProgress === 100 ? "text-green-500" : "text-blue-500",
      bgColor: taskProgress === 100 ? "bg-green-50" : "bg-blue-50",
      iconBg: taskProgress === 100 ? "bg-green-100" : "bg-blue-100",
      ring: taskProgress === 100 ? "ring-green-100" : "ring-blue-100",
      progress: taskProgress,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`${stat.bgColor} border-transparent ring-1 ${stat.ring} shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{stat.label}</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            {stat.progress !== null && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stat.progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, Math.max(0, stat.progress))}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default JobCardStats;