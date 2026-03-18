import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Clock, FileSpreadsheet, FileText, Gauge, Timer } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { CompleteMaintenanceDialog } from "./CompleteMaintenanceDialog";
import { MaintenanceSchedule } from "@/types/maintenance";
import { exportOverdueToPDF, exportOverdueToExcel } from "@/lib/maintenanceExport";
import { getVehicleLatestKm } from "@/lib/maintenanceKmTracking";
import { isReeferFleet } from "@/utils/fleetCategories";

export function OverdueAlerts() {
  const [overdueSchedules, setOverdueSchedules] = useState<MaintenanceSchedule[]>([]);
  const [vehicleKmMap, setVehicleKmMap] = useState<Record<string, number>>({});
  const [vehicleFleetMap, setVehicleFleetMap] = useState<Record<string, string>>({});
  const [reeferHoursMap, setReeferHoursMap] = useState<Record<string, { hours: number; date: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const fetchReeferHours = async (vehicleIds: string[], fleetMap: Record<string, string>) => {
    const fleetNumbers = vehicleIds
      .map(id => fleetMap[id])
      .filter(Boolean)
      .filter(isReeferFleet);

    if (fleetNumbers.length === 0) return {};

    const hoursMap: Record<string, { hours: number; date: string }> = {};

    for (const fleetNumber of fleetNumbers) {
      const { data } = await supabase
        .from("reefer_diesel_records")
        .select("operating_hours, date")
        .eq("reefer_unit", fleetNumber)
        .not("operating_hours", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.operating_hours) {
        hoursMap[fleetNumber] = {
          hours: data.operating_hours,
          date: data.date,
        };
      }
    }

    return hoursMap;
  };

  const fetchOverdue = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch ALL active maintenance schedules
      const { data: allSchedules, error: schedulesError } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("is_active", true);

      if (schedulesError) throw schedulesError;

      if (!allSchedules || allSchedules.length === 0) {
        setOverdueSchedules([]);
        return;
      }

      // 2. Get all vehicle IDs that have schedules
      const vehicleIds = [...new Set(
        (allSchedules || [])
          .filter(s => s.vehicle_id)
          .map(s => s.vehicle_id as string)
      )];

      // 3. Get vehicle fleet numbers
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, fleet_number")
        .in("id", vehicleIds);

      if (vehiclesError) throw vehiclesError;

      const fleetMap: Record<string, string> = {};
      vehicles?.forEach(v => {
        if (v.fleet_number) {
          fleetMap[v.id] = v.fleet_number;
        }
      });
      setVehicleFleetMap(fleetMap);

      // 4. Get latest KM for non-reefer vehicles
      const nonReeferIds = vehicleIds.filter(id => {
        const fleetNumber = fleetMap[id] || "";
        return !isReeferFleet(fleetNumber);
      });

      const latestKmMap = await getVehicleLatestKm(nonReeferIds);
      setVehicleKmMap(latestKmMap);

      // 5. Get latest hours for reefer vehicles
      const reeferHours = await fetchReeferHours(vehicleIds, fleetMap);
      setReeferHoursMap(reeferHours);

      // 6. Check each schedule for overdue status
      const overdue: MaintenanceSchedule[] = [];

      for (const schedule of allSchedules as MaintenanceSchedule[]) {
        const fleetNumber = schedule.vehicle_id ? fleetMap[schedule.vehicle_id] || "" : "";
        const isReefer = isReeferFleet(fleetNumber);

        // Date-based schedules
        if (!schedule.odometer_based && schedule.next_due_date) {
          const dueDate = new Date(schedule.next_due_date);
          const today = new Date();
          if (dueDate < today) {
            overdue.push(schedule);
          }
          continue;
        }

        // KM-based schedules (trucks)
        if (schedule.odometer_based && !isReefer && schedule.vehicle_id && schedule.odometer_interval_km) {
          const currentKm = latestKmMap[schedule.vehicle_id] || 0;
          const lastReading = (schedule.last_odometer_reading as number) || 0;
          const nextServiceKm = lastReading + (schedule.odometer_interval_km as number);

          if (currentKm >= nextServiceKm) {
            overdue.push(schedule);
          }
          continue;
        }

        // Hours-based schedules (reefers)
        if (schedule.odometer_based && isReefer && fleetNumber && schedule.odometer_interval_km) {
          const reeferData = reeferHours[fleetNumber];
          if (!reeferData) continue;

          const currentHours = reeferData.hours;
          const lastReading = (schedule.last_odometer_reading as number) || 0;
          const nextServiceHours = lastReading + (schedule.odometer_interval_km as number);

          if (currentHours >= nextServiceHours) {
            overdue.push(schedule);
          }
        }
      }

      // 7. Sort by priority and due date
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      overdue.sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 999) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] || 999);
        if (priorityDiff !== 0) return priorityDiff;

        // For date-based, sort by due date
        if (a.next_due_date && b.next_due_date) {
          return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
        }
        return 0;
      });

      setOverdueSchedules(overdue);
    } catch (error) {
      console.error("Error fetching overdue schedules:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load overdue schedules";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdue();

    // Auto-refresh every minute
    const interval = setInterval(fetchOverdue, 60000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getDaysOverdue = (dueDate: string) => {
    return differenceInDays(new Date(), new Date(dueDate));
  };

  const handleComplete = (schedule: MaintenanceSchedule) => {
    setSelectedSchedule(schedule);
    setShowCompleteDialog(true);
  };

  const handleCompleted = () => {
    fetchOverdue();
    toast.success("Maintenance completed");
  };

  const getOverdueDetails = (schedule: MaintenanceSchedule) => {
    const fleetNumber = schedule.vehicle_id ? vehicleFleetMap[schedule.vehicle_id] || "" : "";
    const isReefer = isReeferFleet(fleetNumber);

    if (isReefer && schedule.odometer_based && schedule.odometer_interval_km) {
      const reeferData = reeferHoursMap[fleetNumber];
      if (reeferData) {
        const lastReading = schedule.last_odometer_reading || 0;
        const nextServiceHours = lastReading + schedule.odometer_interval_km;
        const currentHours = reeferData.hours;
        const hoursOverdue = currentHours - nextServiceHours;

        return {
          type: "hours" as const,
          current: currentHours,
          last: lastReading,
          next: nextServiceHours,
          overdue: hoursOverdue,
          date: reeferData.date,
        };
      }
    } else if (!isReefer && schedule.odometer_based && schedule.vehicle_id && schedule.odometer_interval_km) {
      const currentKm = vehicleKmMap[schedule.vehicle_id] || 0;
      const lastReading = schedule.last_odometer_reading || 0;
      const nextServiceKm = lastReading + schedule.odometer_interval_km;
      const kmOverdue = currentKm - nextServiceKm;

      return {
        type: "km" as const,
        current: currentKm,
        last: lastReading,
        next: nextServiceKm,
        overdue: kmOverdue,
      };
    } else if (schedule.next_due_date) {
      const daysOverdue = getDaysOverdue(schedule.next_due_date);
      return {
        type: "date" as const,
        days: daysOverdue,
        dueDate: schedule.next_due_date,
      };
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading overdue schedules...</div>
        </CardContent>
      </Card>
    );
  }

  if (overdueSchedules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <div className="mb-2">✓ No overdue maintenance</div>
            <div className="text-sm">All maintenance tasks are up to date</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <CardTitle className="text-red-600">
                  {overdueSchedules.length} Overdue Maintenance Task{overdueSchedules.length !== 1 ? "s" : ""}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportOverdueToPDF(overdueSchedules);
                    toast.success("PDF exported successfully");
                  }}
                  disabled={overdueSchedules.length === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportOverdueToExcel(overdueSchedules);
                    toast.success("Excel exported successfully");
                  }}
                  disabled={overdueSchedules.length === 0}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueSchedules.map((schedule) => {
                const fleetNumber = schedule.vehicle_id ? vehicleFleetMap[schedule.vehicle_id] || "" : "";
                const isReefer = isReeferFleet(fleetNumber);
                const overdueDetails = getOverdueDetails(schedule);

                return (
                  <Card key={schedule.id} className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge className={getPriorityColor(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                            <Badge variant="outline">{schedule.category}</Badge>
                            {isReefer && (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                                <Timer className="w-3 h-3 mr-1" />
                                Reefer
                              </Badge>
                            )}
                            {schedule.odometer_based && (
                              <Badge variant="secondary" className="text-xs">
                                {isReefer ? "Hours-based" : "KM-based"}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-semibold text-lg">
                            {schedule.title}
                            {fleetNumber && (
                              <span className="text-sm font-normal text-muted-foreground ml-2">
                                ({fleetNumber})
                              </span>
                            )}
                          </h3>

                          {schedule.description && (
                            <p className="text-sm text-muted-foreground">{schedule.description}</p>
                          )}

                          <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap gap-y-1">
                            {overdueDetails?.type === "hours" && (
                              <>
                                <div className="flex items-center space-x-1 text-red-600 font-semibold">
                                  <Timer className="w-4 h-4" />
                                  <span>{Math.abs(overdueDetails.overdue).toLocaleString()} hrs overdue</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span>
                                    Current: {overdueDetails.current.toLocaleString()} hrs —
                                    Service due at {overdueDetails.next.toLocaleString()} hrs
                                    {overdueDetails.date && (
                                      <span className="text-xs ml-1">
                                        (as of {format(new Date(overdueDetails.date), "MMM dd")})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </>
                            )}

                            {overdueDetails?.type === "km" && (
                              <>
                                <div className="flex items-center space-x-1 text-red-600 font-semibold">
                                  <Gauge className="w-4 h-4" />
                                  <span>{Math.abs(overdueDetails.overdue).toLocaleString()} km overdue</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <span>
                                    Current: {overdueDetails.current.toLocaleString()} km —
                                    Service due at {overdueDetails.next.toLocaleString()} km
                                  </span>
                                </div>
                              </>
                            )}

                            {overdueDetails?.type === "date" && (
                              <>
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>Due: {format(new Date(overdueDetails.dueDate), "MMM dd, yyyy")}</span>
                                </div>
                                <div className="flex items-center space-x-1 text-red-600 font-semibold">
                                  <Clock className="w-4 h-4" />
                                  <span>{overdueDetails.days} day{overdueDetails.days !== 1 ? "s" : ""} overdue</span>
                                </div>
                              </>
                            )}
                          </div>

                          {schedule.assigned_to && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Assigned to:</span>{" "}
                              <span className="font-medium">{schedule.assigned_to}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleComplete(schedule)}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            Reschedule
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedSchedule && (
        <CompleteMaintenanceDialog
          open={showCompleteDialog}
          onOpenChange={setShowCompleteDialog}
          schedule={selectedSchedule}
          onComplete={handleCompleted}
        />
      )}
    </>
  );
}