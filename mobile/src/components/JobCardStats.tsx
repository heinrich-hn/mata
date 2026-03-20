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

  // Calculate parts costs by category
  const activeParts = parts.filter(p => p.status !== "cancelled");
  const inventoryPartsCost = activeParts
    .filter(p => p.is_from_inventory)
    .reduce((sum, p) => sum + (p.total_price || 0), 0);
  const externalPartsCost = activeParts
    .filter(p => !p.is_from_inventory && !p.is_service)
    .reduce((sum, p) => sum + (p.total_price || 0), 0);
  const servicesCost = activeParts
    .filter(p => p.is_service)
    .reduce((sum, p) => sum + (p.total_price || 0), 0);
  const totalPartsCost = inventoryPartsCost + externalPartsCost + servicesCost;

  // Grand total
  const grandTotal = totalPartsCost + totalLaborCost;

  const stats = [
    {
      icon: TrendingUp,
      label: "Grand Total",
      value: `$${grandTotal.toFixed(2)}`,
      subtext: "Parts + Labor",
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
      labelColor: "text-emerald-700 dark:text-emerald-300",
      valueColor: "text-emerald-900 dark:text-emerald-100",
      subtextColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Package,
      label: "Parts & Materials",
      value: `$${totalPartsCost.toFixed(2)}`,
      subtext: `${activeParts.filter(p => !p.is_service).length} items`,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
      labelColor: "text-blue-700 dark:text-blue-300",
      valueColor: "text-blue-900 dark:text-blue-100",
      subtextColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Wrench,
      label: "Services",
      value: `$${servicesCost.toFixed(2)}`,
      subtext: `${activeParts.filter(p => p.is_service).length} services`,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/50",
      labelColor: "text-purple-700 dark:text-purple-300",
      valueColor: "text-purple-900 dark:text-purple-100",
      subtextColor: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: DollarSign,
      label: "Labor",
      value: `$${totalLaborCost.toFixed(2)}`,
      subtext: `${totalLaborHours.toFixed(1)}h total`,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/50",
      labelColor: "text-orange-700 dark:text-orange-300",
      valueColor: "text-orange-900 dark:text-orange-100",
      subtextColor: "text-orange-600 dark:text-orange-400",
    },
    {
      icon: ListTodo,
      label: "Tasks",
      value: `${completedTasks}/${totalTasks}`,
      subtext: `${taskProgress.toFixed(0)}% complete`,
      iconColor: "text-slate-600 dark:text-slate-400",
      bgColor: "bg-slate-50 dark:bg-slate-900/50",
      labelColor: "text-slate-700 dark:text-slate-300",
      valueColor: "text-slate-900 dark:text-slate-100",
      subtextColor: "text-slate-600 dark:text-slate-400",
    },
    {
      icon: CheckCircle2,
      label: "Progress",
      value: `${taskProgress.toFixed(0)}%`,
      subtext: taskProgress === 100 ? "Ready to close" : "In progress",
      iconColor: taskProgress === 100 ? "text-green-600" : "text-blue-600",
      bgColor: taskProgress === 100 ? "bg-green-50 dark:bg-green-950/50" : "bg-blue-50 dark:bg-blue-950/50",
      labelColor: taskProgress === 100 ? "text-green-700 dark:text-green-300" : "text-blue-700 dark:text-blue-300",
      valueColor: taskProgress === 100 ? "text-green-900 dark:text-green-100" : "text-blue-900 dark:text-blue-100",
      subtextColor: taskProgress === 100 ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className={`border-0 ${stat.bgColor}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-medium ${stat.labelColor}`}>{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.valueColor}`}>{stat.value}</p>
                <p className={`text-xs mt-1 ${stat.subtextColor}`}>{stat.subtext}</p>
              </div>
              <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default JobCardStats;