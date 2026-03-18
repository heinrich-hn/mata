import { cn } from "@/lib/utils";
import { Fragment } from "react";
import type { CalendarEvent } from "./LoadPlanningCalendar";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onLoadDrop: (loadId: string, date: Date, hour: number) => void;
}

export const WeekView = ({
  currentDate,
  events,
  onEventClick,
  onLoadDrop,
}: WeekViewProps) => {
  const weekStart = new Date(currentDate);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const sameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.start_time);
      return sameCalendarDay(eventStart, day) && eventStart.getHours() === hour;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return sameCalendarDay(date, today);
  };

  const getEventColor = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "pickup":
        return "bg-blue-500/20 border-blue-500";
      case "delivery":
        return "bg-green-500/20 border-green-500";
      case "maintenance":
        return "bg-orange-500/20 border-orange-500";
      case "blocked":
        return "bg-red-500/20 border-red-500";
      default:
        return "bg-gray-500/20 border-gray-500";
    }
  };

  return (
    <div className="space-y-2">
      {/* Day headers */}
      <div className="grid grid-cols-8 gap-px bg-border sticky top-0 z-10">
        <div className="bg-background p-2" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "bg-background p-2 text-center",
              isToday(day) && "bg-primary/10"
            )}
          >
            <div className="text-sm font-medium">
              {day.toLocaleDateString("en-US", { weekday: "short" })}
            </div>
            <div
              className={cn(
                "text-lg",
                isToday(day) &&
                  "bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mx-auto"
              )}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-px bg-border">
          {hours.map((hour) => (
            <Fragment key={`row-${hour}`}>
              <div className="bg-background p-2 text-right text-xs text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const hourEvents = getEventsForDayAndHour(day, hour);
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "bg-background p-1 min-h-[60px] relative border-t",
                      isToday(day) && "bg-primary/5"
                    )}
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
                        onLoadDrop(loadId, day, hour);
                      }
                    }}
                  >
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs p-1 rounded mb-1 cursor-pointer hover:opacity-80 border-l-2",
                          getEventColor(event.event_type)
                        )}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="font-medium truncate">
                          {event.load?.destination || event.event_type}
                        </div>
                        {event.vehicle && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {event.vehicle.fleet_number}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
