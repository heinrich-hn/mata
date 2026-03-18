import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, MapPin, Package, Truck } from "lucide-react";
import type { CalendarEvent } from "./LoadPlanningCalendar";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onLoadDrop: (loadId: string, date: Date, hour: number) => void;
}

export const DayView = ({
  currentDate,
  events,
  onEventClick,
  onLoadDrop,
}: DayViewProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });

  const getEventsForHour = (hour: number) => {
    return sortedEvents.filter((event) => {
      const eventStart = new Date(event.start_time);
      return eventStart.getHours() === hour;
    });
  };

  const getEventTypeIcon = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "pickup":
        return <Package className="h-4 w-4" />;
      case "delivery":
        return <MapPin className="h-4 w-4" />;
      case "maintenance":
        return <Truck className="h-4 w-4" />;
      case "blocked":
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "pickup":
        return "border-l-blue-500 bg-blue-500/5";
      case "delivery":
        return "border-l-green-500 bg-green-500/5";
      case "maintenance":
        return "border-l-orange-500 bg-orange-500/5";
      case "blocked":
      default:
        return "border-l-red-500 bg-red-500/5";
    }
  };

  const getEventBadgeVariant = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "pickup":
        return "default" as const;
      case "delivery":
        return "secondary" as const;
      case "maintenance":
        return "outline" as const;
      case "blocked":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="text-center py-4 border-b">
        <h3 className="text-2xl font-bold">
          {currentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {/* Timeline */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="space-y-px">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(hour);
            return (
              <div key={hour} className="flex">
                {/* Time column */}
                <div className="w-20 flex-shrink-0 text-right pr-4 py-2 text-sm text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </div>

                {/* Events column */}
                <div
                  className="flex-1 border-l-2 border-border pl-4 py-2 min-h-[60px]"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("bg-accent");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove("bg-accent");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("bg-accent");
                    const loadId = e.dataTransfer.getData("loadId");
                    if (loadId) {
                      onLoadDrop(loadId, currentDate, hour);
                    }
                  }}
                >
                  {hourEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                      No events
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hourEvents.map((event) => (
                        <Card
                          key={event.id}
                          className={cn(
                            "p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4",
                            getEventColor(event.event_type)
                          )}
                          onClick={() => onEventClick(event)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1">
                                {getEventTypeIcon(event.event_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant={getEventBadgeVariant(event.event_type)}>
                                    {event.event_type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(event.start_time).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    -{" "}
                                    {new Date(event.end_time).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>

                                {event.load && (
                                  <>
                                    <div className="font-medium">
                                      {event.load.customer_name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {event.load.origin} → {event.load.destination}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Weight: {event.load.weight_kg} kg
                                    </div>
                                  </>
                                )}

                                {event.vehicle && (
                                  <div className="flex items-center gap-2 mt-2 text-sm">
                                    <Truck className="h-4 w-4" />
                                    <span>{event.vehicle.fleet_number}</span>
                                  </div>
                                )}

                                {event.notes && (
                                  <div className="text-sm text-muted-foreground mt-2 italic">
                                    {event.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
