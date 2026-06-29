import { PackagingChart } from "@/components/dashboard/PackagingChart";
import { WeeklyChart } from "@/components/dashboard/WeeklyChart";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { CreateLoadDialog } from "@/components/trips/CreateTripDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLoads } from "@/hooks/useTrips";
import type { Load } from "@/hooks/useTrips";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Package,
  Plus,
  Settings,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isBefore, parseISO, startOfDay } from "date-fns";

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { data: loads = [] } = useLoads();

  // ──── Derived metrics using only existing Load fields ────
  const metrics = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    let active = 0;
    let delivered = 0;
    let pending = 0;
    let overdue = 0;

    loads.forEach((load: Load) => {
      // Status counts (match your actual status strings)
      if (load.status === "in-transit") active++;
      if (load.status === "delivered") delivered++;
      if (load.status === "pending") pending++;

      // Overdue: loading_date is in the past and load not delivered
      try {
        const loadDate = startOfDay(parseISO(load.loading_date));
        if (isBefore(loadDate, today) && load.status !== "delivered") {
          overdue++;
        }
      } catch {
        // ignore invalid dates
      }
    });

    return { active, delivered, pending, overdue };
  }, [loads]);

  const quickReports = [
    { label: "Weekly Performance", path: "/reports?view=weekly" },
    { label: "Packaging & Backloads", path: "/reports?view=packaging" },
    { label: "Driver Scorecard", path: "/reports?view=drivers" },
    { label: "Financial Summary", path: "/reports?view=financial" },
  ];

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex gap-2">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Load
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate("/reports")}
            >
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Reports</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickReports.map((report) => (
                  <DropdownMenuItem
                    key={report.path}
                    onClick={() => navigate(report.path)}
                  >
                    {report.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status Cards – now based on real fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pending}</div>
            </CardContent>
          </Card>
          <Card className={metrics.overdue > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Overdue
              </CardTitle>
              <Clock
                className={`h-4 w-4 ${
                  metrics.overdue > 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {metrics.overdue}
                {metrics.overdue > 0 && (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts with drill‑down */}
        <WeeklyChart
          loads={loads}
          onBarClick={(week: string) =>
            navigate(`/reports?view=weekly&week=${week}`)
          }
        />

        <PackagingChart
          loads={loads}
          onSegmentClick={(category: string) =>
            navigate(`/reports?view=packaging&category=${category}`)
          }
        />

        <WeeklySummary loads={loads} />
      </div>

      <CreateLoadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}