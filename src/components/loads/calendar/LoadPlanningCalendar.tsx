import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { useMemo, useState } from "react";

import { CalendarFilters } from "./CalendarFilters";
import { CalendarHeader } from "./CalendarHeader";
import { DayView } from "./DayView";
import { EventDialog } from "./EventDialog";
import { MonthView } from "./MonthView";
import { VehicleAllocationView } from "./VehicleAllocationView";
import { WeekView } from "./WeekView";

// Types
export type CalendarView = "month" | "week" | "day" | "allocation";

export interface Load {
  id?: string; // Optional since it may not be included in the select
  origin: string;
  destination: string;
  weight_kg: number;
  customer_name: string;
  status: string;
}

export interface CalendarEvent {
  id: string;
  load_id?: string;
  event_type: "pickup" | "delivery" | "maintenance" | "blocked";
  start_time: string;
  end_time: string;
  assigned_vehicle_id?: string;
  notes?: string;
  load?: Load; // Use the Load interface
  vehicle?: {
    fleet_number: string | null;
  } | null; // Allow vehicle to be nullable
}

export interface CalendarFilters {
  vehicleIds: string[];
  eventTypes: string[];
  searchTerm: string;
}

// LoadPlanningCalendar Component
export const LoadPlanningCalendar = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [filters, setFilters] = useState<CalendarFilters>({
    vehicleIds: [],
    eventTypes: [],
    searchTerm: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogDefaults, setEventDialogDefaults] = useState<{
    date?: Date;
    startTime?: string;
    endTime?: string;
  }>({});

  // Fetch calendar events
  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", currentDate, view],
    queryFn: async () => {
      const startOfPeriod = getStartOfPeriod(currentDate, view);
      const endOfPeriod = getEndOfPeriod(currentDate, view);

      const { data, error } = await supabase
        .from("calendar_events")
        .select(`
          *,
          load:loads(id, origin, destination, weight_kg, customer_name, status)
        `)
        .gte("start_time", startOfPeriod.toISOString())
        .lte("end_time", endOfPeriod.toISOString())
        .order("start_time");

      if (error) throw error;

      // Fetch vehicle data separately if needed
      const eventsWithVehicles = await Promise.all(
        (data || []).map(async (event) => {
          if (event.assigned_vehicle_id) {
            const { data: vehicleData } = await supabase
              .from("wialon_vehicles")
              .select("fleet_number")
              .eq("id", event.assigned_vehicle_id)
              .single();

            return {
              ...event,
              vehicle: vehicleData || null,
            };
          }
          return {
            ...event,
            vehicle: null,
          };
        })
      );

      return eventsWithVehicles as CalendarEvent[];
    },
  });

  // Fetch loads for the period (unscheduled loads sidebar)
  interface LoadForCalendar {
    id: string;
    load_number: string;
    origin: string;
    destination: string;
    pickup_datetime: string;
    delivery_datetime: string;
    status: string;
    customer_name: string;
    weight_kg: number;
  }
  const { data: loads = [], isLoading: loadsLoading } = useQuery<LoadForCalendar[]>({
    queryKey: ["loads-for-calendar", currentDate, view],
    queryFn: async () => {
      const startOfPeriod = getStartOfPeriod(currentDate, view);
      const endOfPeriod = getEndOfPeriod(currentDate, view);

      const { data, error } = await supabase
        .from("loads")
        .select("*")
        .gte("pickup_datetime", startOfPeriod.toISOString())
        .lte("pickup_datetime", endOfPeriod.toISOString())
        .eq("status", "pending")
        .order("pickup_datetime");

      if (error) throw error;
      return data || [];
    },
  });

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.vehicleIds.length > 0 && event.assigned_vehicle_id) {
        if (!filters.vehicleIds.includes(event.assigned_vehicle_id)) return false;
      }

      if (filters.eventTypes.length > 0) {
        if (!filters.eventTypes.includes(event.event_type)) return false;
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesLoad =
          event.load?.destination?.toLowerCase().includes(searchLower) ||
          event.load?.origin?.toLowerCase().includes(searchLower) ||
          event.load?.customer_name?.toLowerCase().includes(searchLower);

        const matchesVehicle = event.vehicle?.fleet_number
          ?.toLowerCase()
          .includes(searchLower);

        const matchesNotes = event.notes?.toLowerCase().includes(searchLower);

        if (!matchesLoad && !matchesVehicle && !matchesNotes) return false;
      }

      return true;
    });
  }, [events, filters]);

  const handleNavigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const offset = direction === "next" ? 1 : -1;

    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + offset);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7 * offset);
    } else if (view === "day") {
      newDate.setDate(newDate.getDate() + offset);
    }

    setCurrentDate(newDate);
  };

  // Drag-and-drop: schedule load
  const scheduleLoadMutation = useMutation({
    mutationFn: async ({
      loadId,
      date,
      hour,
    }: {
      loadId: string;
      date: Date;
      hour?: number;
    }) => {
      const startTime = new Date(date);
      if (hour !== undefined) {
        startTime.setHours(hour, 0, 0, 0);
      } else {
        startTime.setHours(8, 0, 0, 0); // default 08:00
      }

      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 2); // 2-hour slot

      const { data, error } = await supabase
        .from("calendar_events")
        .insert([
          {
            event_type: "pickup",
            load_id: loadId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["loads-for-calendar"] });
      toast({
        title: "Load scheduled",
        description: "Load has been added to the calendar",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error scheduling load",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleDateClick = (date: Date, hour?: number) => {
    setSelectedEvent(null);
    setEventDialogDefaults({
      date,
      startTime:
        hour !== undefined ? `${hour.toString().padStart(2, "0")}:00` : "08:00",
      endTime:
        hour !== undefined
          ? `${(hour + 1).toString().padStart(2, "0")}:00`
          : "09:00",
    });
    setShowEventDialog(true);
  };

  const handleLoadDrop = (loadId: string, date: Date, hour?: number) => {
    scheduleLoadMutation.mutate({ loadId, date, hour });
  };

  const unscheduledLoads = useMemo(() => {
    const scheduledLoadIds = new Set(
      events.filter((e) => e.load_id).map((e) => e.load_id as string)
    );
    return loads.filter((load) => !scheduledLoadIds.has(load.id)); // Ensure correct type
  }, [loads, events]);

  const isLoading = eventsLoading || loadsLoading;

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onNavigate={handleNavigate}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        filterCount={filters.vehicleIds.length + filters.eventTypes.length}
      />

      {showFilters && (
        <CalendarFilters filters={filters} onFiltersChange={setFilters} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-muted-foreground">Loading calendar...</div>
                </div>
              ) : (
                <>
                  {view === "month" && (
                    <MonthView
                      currentDate={currentDate}
                      events={filteredEvents}
                      onDateClick={handleDateClick}
                      onEventClick={handleEventClick}
                      onLoadDrop={handleLoadDrop}
                    />
                  )}
                  {view === "week" && (
                    <WeekView
                      currentDate={currentDate}
                      events={filteredEvents}
                      onEventClick={handleEventClick}
                      onLoadDrop={handleLoadDrop}
                    />
                  )}
                  {view === "day" && (
                    <DayView
                      currentDate={currentDate}
                      events={filteredEvents}
                      onEventClick={handleEventClick}
                      onLoadDrop={handleLoadDrop}
                    />
                  )}
                  {view === "allocation" && (
                    <VehicleAllocationView date={currentDate} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Unscheduled Loads Sidebar - hide in allocation view */}
        {view !== "allocation" && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Unscheduled Loads
                  <Badge variant="secondary" className="ml-auto">
                    {unscheduledLoads.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unscheduledLoads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All loads scheduled
                  </p>
                ) : (
                  unscheduledLoads.slice(0, 10).map((load) => (
                    <div
                      key={load.id}
                      className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("loadId", load.id);
                      }}
                    >
                      <div className="font-medium text-sm">
                        {load.customer_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {load.origin} → {load.destination}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {load.pickup_datetime &&
                          new Date(load.pickup_datetime).toLocaleDateString()}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {load.weight_kg} kg
                      </Badge>
                    </div>
                  ))
                )}
                {unscheduledLoads.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{unscheduledLoads.length - 10} more
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Event Dialog */}
      <EventDialog
        open={showEventDialog}
        onOpenChange={(open) => {
          setShowEventDialog(open);
          if (!open) {
            setSelectedEvent(null);
            setEventDialogDefaults({});
          }
        }}
        event={selectedEvent}
        defaultDate={eventDialogDefaults.date}
        defaultStartTime={eventDialogDefaults.startTime}
        defaultEndTime={eventDialogDefaults.endTime}
      />
    </div>
  );
};

// Helper functions
function getStartOfPeriod(date: Date, view: CalendarView): Date {
  const start = new Date(date);
  if (view === "month" || view === "allocation") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (view === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (view === "day") {
    start.setHours(0, 0, 0, 0);
  }
  return start;
}

function getEndOfPeriod(date: Date, view: CalendarView): Date {
  const end = new Date(date);
  if (view === "month" || view === "allocation") {
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (view === "week") {
    const day = end.getDay();
    end.setDate(end.getDate() + (6 - day));
    end.setHours(23, 59, 59, 999);
  } else if (view === "day") {
    end.setHours(23, 59, 59, 999);
  }
  return end;
}
