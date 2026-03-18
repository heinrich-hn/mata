import { MaintenanceSchedule } from "@/types/maintenance";
import { 
  addMonths, 
  eachDayOfInterval, 
  endOfMonth, 
  format, 
  isSameMonth,
  startOfMonth, 
  subMonths,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { CalendarDayCell } from "./CalendarDayCell";
import { Button } from "@/components/ui/button";

// ==================== Types ====================
interface MaintenanceGridCalendarProps {
  schedules: MaintenanceSchedule[];
  onDateClick: (date: Date) => void;
  onEventClick: (schedule: MaintenanceSchedule) => void;
}

interface EventsByDateMap {
  [dateKey: string]: MaintenanceSchedule[];
}

// ==================== Constants ====================
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MAX_EVENTS_PER_CELL = 3;

// ==================== Helper Functions ====================
const getDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

// ==================== Sub-components ====================
interface CalendarHeaderProps {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

const CalendarHeader = ({ 
  currentMonth, 
  onPrevMonth, 
  onNextMonth, 
  onToday 
}: CalendarHeaderProps) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <CalendarIcon className="h-5 w-5 text-muted-foreground hidden sm:block" />
      <h3 className="text-xl md:text-2xl font-bold">
        {format(currentMonth, 'MMMM yyyy')}
      </h3>
    </div>
    
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevMonth}
        className="h-8 w-8"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onToday}
        className="hidden md:flex px-3"
        aria-label="Go to today"
      >
        Today
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        onClick={onNextMonth}
        className="h-8 w-8"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

interface WeekdayHeaderProps {
  weekdays: readonly string[];
}

const WeekdayHeader = ({ weekdays }: WeekdayHeaderProps) => (
  <div className="grid grid-cols-7 gap-1 mb-1">
    {weekdays.map(day => (
      <div
        key={day}
        className="p-2 text-center font-semibold text-sm md:text-base text-muted-foreground/80"
      >
        {day}
      </div>
    ))}
  </div>
);

// ==================== Main Component ====================
export function MaintenanceGridCalendar({
  schedules,
  onDateClick,
  onEventClick
}: MaintenanceGridCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Memoized event map for O(1) lookup
  const eventsByDate = useMemo(() => {
    const map: EventsByDateMap = {};
    
    schedules.forEach(schedule => {
      if (!schedule.next_due_date) return;
      
      const dateKey = getDateKey(new Date(schedule.next_due_date));
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(schedule);
    });

    // Sort events within each day by priority
    Object.values(map).forEach(dayEvents => {
      dayEvents.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
        return aPriority - bPriority;
      });
    });

    return map;
  }, [schedules]);

  // Memoized calendar days generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get the full week view (Sunday to Saturday)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Memoized event fetcher for a specific day
  const getEventsForDay = useCallback((date: Date): MaintenanceSchedule[] => {
    return eventsByDate[getDateKey(date)] || [];
  }, [eventsByDate]);

  // Navigation handlers
  const handlePrevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  const handleToday = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  return (
    <div className="space-y-2">
      <CalendarHeader
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      <div className="bg-card rounded-lg border p-2 sm:p-4">
        <WeekdayHeader weekdays={WEEKDAYS} />

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date) => {
            const events = getEventsForDay(date);
            const isCurrentMonth = isSameMonth(date, currentMonth);

            return (
              <CalendarDayCell
                key={date.toISOString()}
                day={date.getDate()}
                date={date}
                isCurrentMonth={isCurrentMonth}
                events={events}
                onDateClick={onDateClick}
                onEventClick={onEventClick}
                maxEventsToShow={MAX_EVENTS_PER_CELL}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive/20 border border-destructive" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-secondary/20 border border-secondary" />
            <span>Medium/Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}