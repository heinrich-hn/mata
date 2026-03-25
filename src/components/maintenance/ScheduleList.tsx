import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MaintenanceSchedule } from "@/types/maintenance";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateKmStatus, getVehicleLatestKm } from "@/lib/maintenanceKmTracking";
import { getFleetSubcategory, type FleetSubcategory } from "@/utils/fleetCategories";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, RefreshCw, Wrench } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScheduleDetailsDialog } from "./ScheduleDetailsDialog";
import { UpdateServiceReadingDialog } from "./UpdateServiceReadingDialog";
import { exportSchedulesToPDF, exportSchedulesToExcel } from "@/lib/maintenanceExport";
import { useToast } from "@/hooks/use-toast";

interface ScheduleListProps {
  schedules: MaintenanceSchedule[];
  onUpdate: () => void;
  showOverdueOnly?: boolean;
}

type SubcategoryFilter = FleetSubcategory | "all";

export function ScheduleList({ schedules, onUpdate, showOverdueOnly }: ScheduleListProps) {
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [serviceReadingSchedule, setServiceReadingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [serviceReadingIsReefer, setServiceReadingIsReefer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter] = useState("all");
  const [subcategoryFilter] = useState<SubcategoryFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const vehicleIds = useMemo(
    () => [...new Set(schedules.filter(s => s.vehicle_id).map(s => s.vehicle_id!))],
    [schedules]
  );

  const { data: vehicleFleetMap = {} } = useQuery({
    queryKey: ["vehicle-fleet-map", vehicleIds],
    queryFn: async () => {
      if (!vehicleIds.length) return {};
      const { data } = await supabase
        .from("vehicles")
        .select("id, fleet_number")
        .in("id", vehicleIds);

      const map: Record<string, string> = {};
      data?.forEach(v => (map[v.id] = v.fleet_number || ""));
      return map;
    },
    enabled: vehicleIds.length > 0,
  });

  const { data: vehicleOdometers = {} } = useQuery({
    queryKey: ["vehicle-odometers", vehicleIds],
    queryFn: () => getVehicleLatestKm(vehicleIds),
    enabled: vehicleIds.length > 0,
  });

  const { data: reeferHoursMap = {} } = useQuery({
    queryKey: ["reefer-hours-map", vehicleIds, vehicleFleetMap],
    queryFn: async () => {
      if (!vehicleIds.length) return {};

      const fleetNumbers = Object.values(vehicleFleetMap).filter(Boolean);
      if (fleetNumbers.length === 0) return {};

      const hoursMap: Record<string, number> = {};

      for (const fleetNumber of fleetNumbers) {
        const { data } = await supabase
          .from("reefer_diesel_records")
          .select("operating_hours")
          .eq("reefer_unit", fleetNumber)
          .not("operating_hours", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.operating_hours) {
          hoursMap[fleetNumber] = data.operating_hours;
        }
      }

      return hoursMap;
    },
    enabled: vehicleIds.length > 0 && Object.keys(vehicleFleetMap).length > 0,
  });

  const enriched = useMemo(() => {
    return schedules
      .map(schedule => {
        const fleetNumber = schedule.vehicle_id
          ? vehicleFleetMap[schedule.vehicle_id] || ""
          : "";

        const subcategory = getFleetSubcategory(fleetNumber);
        const isReefer = subcategory === "REEFERS";

        const today = new Date();
        const dueDate = schedule.next_due_date ? new Date(schedule.next_due_date) : null;
        const daysUntilDue = dueDate
          ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let status = "Scheduled";
        let progressPercent = 0;
        let label = "";

        if (schedule.odometer_based && schedule.vehicle_id && schedule.odometer_interval_km) {
          const last = schedule.last_odometer_reading || 0;

          if (isReefer) {
            const current = reeferHoursMap[fleetNumber] || 0;
            const interval = schedule.odometer_interval_km;
            const nextServiceHours = last + interval;
            const remaining = nextServiceHours - current;

            if (interval > 0) {
              const hoursUsed = Math.max(current - last, 0);
              progressPercent = Math.min(
                (hoursUsed / interval) * 100,
                100
              );
            }

            if (remaining <= 0) {
              status = "Overdue";
              label = `${Math.abs(remaining).toLocaleString()} hrs overdue`;
            } else if (remaining <= interval * 0.15) {
              status = "Due Soon";
              label = `${remaining.toLocaleString()} hrs remaining`;
            } else {
              status = "Scheduled";
              label = `${remaining.toLocaleString()} hrs remaining`;
            }
          } else {
            const current = vehicleOdometers[schedule.vehicle_id] || 0;
            const km = calculateKmStatus(
              schedule.odometer_interval_km,
              last,
              current
            );

            progressPercent = km.progressPercent;
            status = km.isOverdue
              ? "Overdue"
              : km.isApproaching
                ? "Due Soon"
                : "Scheduled";

            label = km.isOverdue
              ? `${Math.abs(km.remainingKm).toLocaleString()} km overdue`
              : `${km.remainingKm.toLocaleString()} km remaining`;
          }
        } else if (daysUntilDue !== null) {
          if (daysUntilDue < 0) {
            status = "Overdue";
            label = `${Math.abs(daysUntilDue)} days overdue`;
          } else if (daysUntilDue === 0) {
            status = "Due Today";
            label = "Due today";
          } else if (daysUntilDue <= 7) {
            status = "Due Soon";
            label = `${daysUntilDue} days remaining`;
          } else {
            status = "Scheduled";
            label = dueDate ? format(dueDate, "MMM dd, yyyy") : "";
          }
        }

        return {
          ...schedule,
          fleetNumber,
          subcategory,
          status,
          progressPercent,
          label,
        };
      })
      .filter(s => {
        const matchesSearch =
          s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.maintenance_type.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPriority =
          priorityFilter === "all" || s.priority === priorityFilter;

        const matchesSubcategory =
          subcategoryFilter === "all" || s.subcategory === subcategoryFilter;

        if (showOverdueOnly) return s.status === "Overdue";

        return matchesSearch && matchesPriority && matchesSubcategory;
      });
  }, [schedules, vehicleFleetMap, vehicleOdometers, reeferHoursMap, searchTerm, priorityFilter, subcategoryFilter, showOverdueOnly]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof enriched> = {};
    enriched.forEach(s => {
      if (!map[s.subcategory]) map[s.subcategory] = [];
      map[s.subcategory].push(s);
    });
    return map;
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <Input
          placeholder="Search schedules..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!enriched.length}
            onClick={() => {
              exportSchedulesToPDF(enriched, "Maintenance Schedules");
              toast({ title: "PDF exported" });
            }}
          >
            PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!enriched.length}
            onClick={() => {
              exportSchedulesToExcel(enriched, "maintenance-schedules");
              toast({ title: "Excel exported" });
            }}
          >
            Excel
          </Button>
        </div>
      </div>

      {Object.entries(grouped).map(([subcat, items]) => {
        const overdueCount = items.filter(i => i.status === "Overdue").length;
        const soonCount = items.filter(i => i.status === "Due Soon").length;

        return (
          <div key={subcat} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 flex justify-between items-center">
              <div>
                <div className="font-semibold">{subcat}</div>
                <div className="text-xs text-muted-foreground">
                  {items.length} schedules • {overdueCount} overdue • {soonCount} due soon
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={refreshing}
                title="Refresh current km / hours"
                onClick={async () => {
                  setRefreshing(true);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["vehicle-odometers"] }),
                    queryClient.invalidateQueries({ queryKey: ["reefer-hours-map"] }),
                  ]);
                  setRefreshing(false);
                  toast({ title: "Readings refreshed" });
                }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Fleet</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(schedule => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {schedule.title}
                    </TableCell>

                    <TableCell>
                      {schedule.fleetNumber || "—"}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {schedule.priority}
                      </Badge>
                    </TableCell>

                    <TableCell className="space-y-1 min-w-[180px]">
                      {schedule.progressPercent > 0 && (
                        <Progress value={schedule.progressPercent} className="h-2" />
                      )}
                      <div className="text-xs text-muted-foreground">
                        {schedule.label}
                      </div>
                      <Badge
                        variant={
                          schedule.status === "Overdue"
                            ? "destructive"
                            : schedule.status === "Due Soon"
                              ? "default"
                              : "outline"
                        }
                      >
                        {schedule.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {schedule.assigned_to || "Unassigned"}
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSchedule(schedule)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {schedule.odometer_based && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={`Update service ${schedule.subcategory === "REEFERS" ? "hours" : "km"}`}
                            onClick={() => {
                              setServiceReadingSchedule(schedule);
                              setServiceReadingIsReefer(schedule.subcategory === "REEFERS");
                            }}
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}

      {enriched.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No schedules found matching your criteria.
        </div>
      )}

      {selectedSchedule && (
        <ScheduleDetailsDialog
          schedule={selectedSchedule}
          open={!!selectedSchedule}
          onOpenChange={open => !open && setSelectedSchedule(null)}
          onUpdate={onUpdate}
        />
      )}

      {serviceReadingSchedule && (
        <UpdateServiceReadingDialog
          open={!!serviceReadingSchedule}
          onOpenChange={open => !open && setServiceReadingSchedule(null)}
          schedule={serviceReadingSchedule}
          isReefer={serviceReadingIsReefer}
          onComplete={() => {
            setServiceReadingSchedule(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}