import { useState, useMemo, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { MaintenanceSchedule } from "@/types/maintenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  format,
  isSameDay,
  isToday,
  isPast,
  addMonths,
  subMonths
} from "date-fns";
import { ScheduleDetailsDialog } from "./ScheduleDetailsDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MaintenanceGridCalendar } from "./MaintenanceGridCalendar";

interface MaintenanceCalendarProps {
  schedules: MaintenanceSchedule[];
  onUpdate: () => void;
}

type ScheduleStatus = "overdue" | "due-today" | "upcoming" | "inactive";

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "secondary";
  }
};

export function MaintenanceCalendar({
  schedules,
  onUpdate
}: MaintenanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [selectedSchedule, setSelectedSchedule] =
    useState<MaintenanceSchedule | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "grid" | "list">(
    "calendar"
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const schedulesWithStatus = useMemo(() => {
    return schedules.map((schedule) => {
      if (!schedule.next_due_date) {
        return { schedule, status: "inactive" as ScheduleStatus };
      }

      const dueDate = new Date(schedule.next_due_date);

      let status: ScheduleStatus = "upcoming";

      if (isPast(dueDate) && !isToday(dueDate)) {
        status = "overdue";
      } else if (isToday(dueDate)) {
        status = "due-today";
      }

      return { schedule, status };
    });
  }, [schedules]);

  const schedulesOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];

    return schedulesWithStatus
      .filter(
        ({ schedule }) =>
          schedule.next_due_date &&
          isSameDay(new Date(schedule.next_due_date), selectedDate)
      )
      .map((item) => item.schedule);
  }, [schedulesWithStatus, selectedDate]);

  const {
    modifiers,
    overdueCount,
    dueTodayCount,
    upcomingCount
  } = useMemo(() => {
    const result: Record<string, Date[]> = {
      criticalOverdue: [],
      highOverdue: [],
      criticalDueToday: [],
      highDueToday: [],
      normalDueToday: [],
      criticalUpcoming: [],
      highUpcoming: [],
      normalUpcoming: []
    };

    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;

    for (const { schedule, status } of schedulesWithStatus) {
      if (!schedule.next_due_date) continue;

      const date = new Date(schedule.next_due_date);
      const { priority } = schedule;

      if (status === "overdue") {
        overdue++;
        if (priority === "critical") result.criticalOverdue.push(date);
        else result.highOverdue.push(date);
      }

      if (status === "due-today") {
        dueToday++;
        if (priority === "critical") result.criticalDueToday.push(date);
        else if (["high", "medium"].includes(priority))
          result.highDueToday.push(date);
        else result.normalDueToday.push(date);
      }

      if (status === "upcoming") {
        upcoming++;
        if (priority === "critical") result.criticalUpcoming.push(date);
        else if (["high", "medium"].includes(priority))
          result.highUpcoming.push(date);
        else result.normalUpcoming.push(date);
      }
    }

    return {
      modifiers: result,
      overdueCount: overdue,
      dueTodayCount: dueToday,
      upcomingCount: upcoming
    };
  }, [schedulesWithStatus]);

  const modifiersClassNames = {
    criticalOverdue:
      "bg-destructive text-destructive-foreground font-bold ring-2 ring-destructive ring-offset-2",
    highOverdue:
      "bg-destructive/70 text-destructive-foreground font-bold",
    criticalDueToday:
      "bg-warning text-warning-foreground font-bold ring-2 ring-warning ring-offset-2",
    highDueToday:
      "bg-warning/70 text-warning-foreground font-bold",
    normalDueToday:
      "bg-warning/50 text-warning-foreground font-semibold",
    criticalUpcoming:
      "bg-primary text-primary-foreground font-bold ring-2 ring-primary ring-offset-2",
    highUpcoming:
      "bg-primary/60 text-primary-foreground font-semibold",
    normalUpcoming:
      "bg-primary/30 text-primary-foreground"
  };

  const goPrevMonth = useCallback(
    () => setCurrentMonth((prev) => subMonths(prev, 1)),
    []
  );

  const goNextMonth = useCallback(
    () => setCurrentMonth((prev) => addMonths(prev, 1)),
    []
  );

  const sortByDueDate = (a: MaintenanceSchedule, b: MaintenanceSchedule) => {
    if (!a.next_due_date || !b.next_due_date) return 0;
    return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
  };

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) =>
          setViewMode(v as "calendar" | "grid" | "list")
        }
      >
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        className={cn(
          "grid gap-4",
          viewMode === "list"
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[1.5fr,1fr]"
        )}
      >
        <Card>
          <CardContent className="p-6">
            {viewMode === "calendar" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {format(currentMonth, "MMMM yyyy")}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goPrevMonth}
                      className="px-2"
                    >
                      &lt;
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMonth(new Date())}
                      className="hidden md:inline-flex"
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goNextMonth}
                      className="px-2"
                    >
                      &gt;
                    </Button>
                  </div>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                />
              </>
            ) : viewMode === "grid" ? (
              <MaintenanceGridCalendar
                schedules={schedules}
                onDateClick={setSelectedDate}
                onEventClick={setSelectedSchedule}
              />
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 text-destructive">
                    Overdue ({overdueCount})
                  </h4>
                  <div className="space-y-2">
                    {schedulesWithStatus
                      .filter(({ status }) => status === "overdue")
                      .map(({ schedule }) => schedule)
                      .sort(sortByDueDate)
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-3 border rounded cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSchedule(schedule)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{schedule.title}</span>
                            <Badge variant={getPriorityVariant(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(schedule.next_due_date!), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.maintenance_type}
                          </p>
                        </div>
                      ))}
                    {overdueCount === 0 && (
                      <p className="text-center text-muted-foreground">
                        No overdue schedules
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-warning">
                    Due Today ({dueTodayCount})
                  </h4>
                  <div className="space-y-2">
                    {schedulesWithStatus
                      .filter(({ status }) => status === "due-today")
                      .map(({ schedule }) => schedule)
                      .sort(sortByDueDate)
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-3 border rounded cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSchedule(schedule)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{schedule.title}</span>
                            <Badge variant={getPriorityVariant(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(schedule.next_due_date!), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.maintenance_type}
                          </p>
                        </div>
                      ))}
                    {dueTodayCount === 0 && (
                      <p className="text-center text-muted-foreground">
                        No schedules due today
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-primary">
                    Upcoming ({upcomingCount})
                  </h4>
                  <div className="space-y-2">
                    {schedulesWithStatus
                      .filter(({ status }) => status === "upcoming")
                      .map(({ schedule }) => schedule)
                      .sort(sortByDueDate)
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className="p-3 border rounded cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSchedule(schedule)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{schedule.title}</span>
                            <Badge variant={getPriorityVariant(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Due: {format(new Date(schedule.next_due_date!), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.maintenance_type}
                          </p>
                        </div>
                      ))}
                    {upcomingCount === 0 && (
                      <p className="text-center text-muted-foreground">
                        No upcoming schedules
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {viewMode !== "list" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate
                  ? format(selectedDate, "MMMM d, yyyy")
                  : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedulesOnSelectedDate.length > 0 ? (
                <div className="space-y-4">
                  {schedulesOnSelectedDate.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3 border rounded cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSchedule(schedule)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{schedule.title}</span>
                        <Badge variant={getPriorityVariant(schedule.priority)}>
                          {schedule.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {schedule.maintenance_type}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  No schedules for this date
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedSchedule && (
        <ScheduleDetailsDialog
          schedule={selectedSchedule}
          open
          onOpenChange={() => setSelectedSchedule(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}