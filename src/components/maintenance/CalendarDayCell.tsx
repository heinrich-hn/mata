import { MaintenanceSchedule } from "@/types/maintenance";
import { CalendarEventPill } from "./CalendarEventPill";
import { cn } from "@/lib/utils";
import { isToday, format } from "date-fns";
import { memo, useMemo } from "react";

interface CalendarDayCellProps {
  day: number | null;
  date: Date | null;
  isCurrentMonth: boolean;
  events: MaintenanceSchedule[];
  onDateClick: (date: Date) => void;
  onEventClick: (schedule: MaintenanceSchedule) => void;
  maxEventsToShow?: number;
}

// Priority order for consistent display
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// Helper function to sort events by priority
const sortEventsByPriority = (events: MaintenanceSchedule[]): MaintenanceSchedule[] => {
  return [...events].sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 4;
    const bPriority = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 4;
    return aPriority - bPriority;
  });
};

// Memoize the component to prevent unnecessary re-renders
export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  date,
  isCurrentMonth,
  events,
  onDateClick,
  onEventClick,
  maxEventsToShow = 3
}: CalendarDayCellProps) {
  // All hooks must be called before any conditional returns
  // Even if date is null, we need to call hooks in the same order
  
  // Memoize sliced events to avoid recalculating on every render
  const visibleEvents = useMemo(
    () => events.slice(0, maxEventsToShow),
    [events, maxEventsToShow]
  );
  
  // Memoize sorted events for consistent display
  const sortedVisibleEvents = useMemo(
    () => sortEventsByPriority(visibleEvents),
    [visibleEvents]
  );

  // Calculate hidden count
  const hiddenCount = events.length - maxEventsToShow;
  
  // Check if date is today (safe even if date is null)
  const isTodayDate = date ? isToday(date) : false;

  // Handle event click with stop propagation
  const handleEventClick = (e: React.MouseEvent, event: MaintenanceSchedule) => {
    e.stopPropagation();
    onEventClick(event);
  };

  // Handle cell click
  const handleCellClick = () => {
    if (date) {
      onDateClick(date);
    }
  };

  // Early return for empty cells (after all hooks)
  if (!day || !date) {
    return (
      <div 
        className="h-24 md:h-28 border border-border bg-muted/20" 
        role="gridcell"
        aria-disabled="true"
      />
    );
  }

  return (
    <div
      onClick={handleCellClick}
      className={cn(
        "h-24 md:h-28 border border-border p-1 md:p-2 overflow-hidden transition-all duration-200 cursor-pointer group",
        isCurrentMonth 
          ? "bg-background hover:bg-accent/50 hover:shadow-sm" 
          : "bg-muted/30 hover:bg-muted/50",
        isTodayDate && "ring-2 ring-primary/20 bg-accent/5"
      )}
      role="gridcell"
      aria-label={format(date, 'PPPP')}
      aria-current={isTodayDate ? 'date' : undefined}
    >
      {/* Day Number */}
      <div className="flex justify-between items-start">
        <span
          className={cn(
            "inline-flex items-center justify-center text-sm md:text-base font-semibold transition-colors",
            isTodayDate 
              ? "bg-primary text-primary-foreground w-6 h-6 rounded-full" 
              : "w-6 h-6",
            !isCurrentMonth && "text-muted-foreground"
          )}
        >
          {day}
        </span>
        
        {/* Event count badge - visible on hover */}
        {events.length > maxEventsToShow && (
          <span className="text-xs text-muted-foreground bg-background/80 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {events.length}
          </span>
        )}
      </div>

      {/* Events Container */}
      <div className="space-y-1 mt-1">
        {sortedVisibleEvents.map((event) => (
          <div
            key={event.id}
            onClick={(e) => handleEventClick(e, event)}
            className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <CalendarEventPill
              schedule={event}
              onClick={onEventClick}
            />
          </div>
        ))}
        
        {/* Hidden count indicator */}
        {hiddenCount > 0 && (
          <div 
            className="text-xs text-muted-foreground font-medium pl-1 hover:text-foreground transition-colors"
            title={`${hiddenCount} more event${hiddenCount === 1 ? '' : 's'}`}
          >
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
});