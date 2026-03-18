import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./LoadPlanningCalendar";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onLoadDrop: (loadId: string, date: Date) => void;
}

const sameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const MonthView = ({
  currentDate,
  events,
  onDateClick,
  onEventClick,
  onLoadDrop,
}: MonthViewProps) => {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  endDate.setHours(23, 59, 59, 999);

  const days: Date[] = [];
  const currentDay = new Date(startDate);

  while (currentDay <= endDate) {
    days.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return sameCalendarDay(eventDate, date);
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return sameCalendarDay(date, today);
  };

  const isCurrentMonth = (date: Date) =>
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear();

  const getEventColor = (eventType: CalendarEvent["event_type"]) => {
    switch (eventType) {
      case "pickup":
        return "bg-blue-500";
      case "delivery":
        return "bg-green-500";
      case "maintenance":
        return "bg-orange-500";
      case "blocked":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px bg-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-background p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border min-h-[600px]">
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-background p-2 min-h-[100px] cursor-pointer hover:bg-accent transition-colors",
                !isCurrentMonth(day) && "opacity-50"
              )}
              onClick={() => onDateClick(day)}
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
                  onLoadDrop(loadId, day);
                }
              }}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1",
                  isToday(day) &&
                    "bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center"
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80",
                      getEventColor(event.event_type),
                      "text-white"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {event.load?.destination || event.event_type}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-4 border-t">
        <span className="text-sm font-medium">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-xs">Pickup</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs">Delivery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span className="text-xs">Maintenance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-xs">Blocked</span>
        </div>
      </div>
    </div>
  );
};
