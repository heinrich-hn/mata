import { MobileQuickComplete } from "@/components/maintenance/MobileQuickComplete";
import { AddScheduleDialog } from "@/components/maintenance/AddScheduleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceSchedule } from "@/types/maintenance";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Truck,
  Wrench,
} from "lucide-react";
import { useState } from "react";

const MobileMaintenance = () => {
  const [quickCompleteOpen, setQuickCompleteOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: schedules = [], refetch } = useQuery({
    queryKey: ["maintenance-schedules-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("is_active", true)
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        schedule_type: s.schedule_type as MaintenanceSchedule["schedule_type"],
      })) as MaintenanceSchedule[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, fleet_number, registration_number");
      if (error) throw error;
      return data || [];
    },
  });

  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getScheduleUrgency = (schedule: MaintenanceSchedule) => {
    const dueDate = new Date(schedule.next_due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    if (diffDays <= 3) return "upcoming";
    return "scheduled";
  };

  const overdueSchedules = schedules.filter(s => getScheduleUrgency(s) === "overdue");
  const todaySchedules = schedules.filter(s => getScheduleUrgency(s) === "today");
  const upcomingSchedules = schedules.filter(s => getScheduleUrgency(s) === "upcoming");
  const scheduledSchedules = schedules.filter(s => getScheduleUrgency(s) === "scheduled");

  const { data: completedCount = 0 } = useQuery({
    queryKey: ["maintenance-completed-count"],
    queryFn: async () => {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("maintenance_schedule_history")
        .select("id")
        .eq("status", "completed")
        .gte("completed_date", startOfMonth);
      return data?.length || 0;
    },
  });

  const handleQuickComplete = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setQuickCompleteOpen(true);
  };

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case "overdue": return "border-l-red-500 bg-red-50/50";
      case "today": return "border-l-orange-500 bg-orange-50/50";
      case "upcoming": return "border-l-yellow-500";
      default: return "border-l-gray-300";
    }
  };

  const ScheduleCard = ({ schedule }: { schedule: MaintenanceSchedule }) => {
    const vehicle = vehicleMap.get(schedule.vehicle_id);
    const urgency = getScheduleUrgency(schedule);
    const dueDate = new Date(schedule.next_due_date);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return (
      <Card className={cn("border-l-4 active:scale-[0.98] transition-transform", getUrgencyStyle(urgency))}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-tight truncate">
                {schedule.title || schedule.service_type}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                {vehicle && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {vehicle.fleet_number || vehicle.registration_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {dueDate.toLocaleDateString()}
                </span>
                {schedule.category && (
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 h-5">
                    {schedule.category}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {urgency === "overdue" && (
                <Badge variant="destructive" className="text-[11px] px-1.5 py-0.5">
                  {Math.abs(diffDays)}d overdue
                </Badge>
              )}
              {urgency === "today" && (
                <Badge className="bg-orange-500 text-white text-[11px] px-1.5 py-0.5">
                  Due today
                </Badge>
              )}
              {urgency === "upcoming" && (
                <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 border-yellow-300 text-yellow-700">
                  In {diffDays}d
                </Badge>
              )}
              {urgency === "scheduled" && (
                <span className="text-[11px] text-muted-foreground">
                  In {diffDays}d
                </span>
              )}
            </div>
          </div>

          {/* Quick Complete Button */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            {schedule.priority && (
              <Badge
                variant="outline"
                className={cn("text-[11px] px-1.5 py-0.5", {
                  "border-red-300 text-red-700": schedule.priority === "critical",
                  "border-orange-300 text-orange-700": schedule.priority === "high",
                  "border-blue-300 text-blue-700": schedule.priority === "medium",
                  "border-gray-300 text-gray-600": schedule.priority === "low",
                })}
              >
                {schedule.priority}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5 rounded-lg px-3"
              onClick={(e) => {
                e.stopPropagation();
                handleQuickComplete(schedule.id);
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance
          </h1>
          <p className="text-xs text-muted-foreground">
            {overdueSchedules.length > 0 && (
              <span className="text-destructive font-medium">{overdueSchedules.length} overdue</span>
            )}
            {overdueSchedules.length > 0 && todaySchedules.length > 0 && " · "}
            {todaySchedules.length > 0 && `${todaySchedules.length} due today`}
            {(overdueSchedules.length > 0 || todaySchedules.length > 0) && " · "}
            {completedCount} completed this month
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{overdueSchedules.length}</p>
            <p className="text-[11px] text-muted-foreground">Overdue</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-orange-600">{todaySchedules.length}</p>
            <p className="text-[11px] text-muted-foreground">Today</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-yellow-600">{upcomingSchedules.length}</p>
            <p className="text-[11px] text-muted-foreground">Soon</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-600">{completedCount}</p>
            <p className="text-[11px] text-muted-foreground">Done</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="urgent" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 rounded-xl">
          <TabsTrigger value="urgent" className="text-xs rounded-lg">
            Urgent ({overdueSchedules.length + todaySchedules.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs rounded-lg">
            Upcoming ({upcomingSchedules.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs rounded-lg">
            All ({schedules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urgent" className="mt-3 space-y-2">
          {overdueSchedules.length === 0 && todaySchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
              No urgent maintenance tasks
            </div>
          ) : (
            <>
              {overdueSchedules.map(s => <ScheduleCard key={s.id} schedule={s} />)}
              {todaySchedules.map(s => <ScheduleCard key={s.id} schedule={s} />)}
            </>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-3 space-y-2">
          {upcomingSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No upcoming tasks in the next 3 days</div>
          ) : (
            upcomingSchedules.map(s => <ScheduleCard key={s.id} schedule={s} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-3 space-y-2">
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No maintenance schedules</div>
          ) : (
            [...overdueSchedules, ...todaySchedules, ...upcomingSchedules, ...scheduledSchedules].map(s => (
              <ScheduleCard key={s.id} schedule={s} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* FAB - New Schedule */}
      <Button
        className="fab h-14 w-14 rounded-2xl shadow-lg"
        onClick={() => setAddDialogOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialogs */}
      <MobileQuickComplete
        open={quickCompleteOpen}
        onOpenChange={setQuickCompleteOpen}
        scheduleId={selectedScheduleId}
        onSuccess={() => {
          setQuickCompleteOpen(false);
          refetch();
        }}
      />

      <AddScheduleDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
};

export default MobileMaintenance;