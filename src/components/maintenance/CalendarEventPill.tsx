import { MaintenanceSchedule } from "@/types/maintenance";
import { cn } from "@/lib/utils";
import { isPast, isToday } from "date-fns";

interface CalendarEventPillProps {
  schedule: MaintenanceSchedule;
  onClick: (schedule: MaintenanceSchedule) => void;
}

export function CalendarEventPill({ schedule, onClick }: CalendarEventPillProps) {
  const getScheduleStatus = () => {
    if (!schedule.next_due_date) return 'inactive';
    const dueDate = new Date(schedule.next_due_date);
    if (isPast(dueDate) && !isToday(dueDate)) return 'overdue';
    if (isToday(dueDate)) return 'due-today';
    return 'upcoming';
  };

  const getEventClasses = () => {
    const status = getScheduleStatus();
    const priority = schedule.priority;

    // 8-state color coding system
    if (status === 'overdue') {
      if (priority === 'critical') return "bg-destructive text-destructive-foreground ring-1 ring-destructive font-bold";
      return "bg-destructive/70 text-destructive-foreground font-semibold";
    }

    if (status === 'due-today') {
      if (priority === 'critical') return "bg-warning text-warning-foreground ring-1 ring-warning font-bold";
      if (['high', 'medium'].includes(priority)) return "bg-warning/70 text-warning-foreground font-semibold";
      return "bg-warning/50 text-warning-foreground";
    }

    if (status === 'upcoming') {
      if (priority === 'critical') return "bg-primary text-primary-foreground ring-1 ring-primary font-bold";
      if (['high', 'medium'].includes(priority)) return "bg-primary/60 text-primary-foreground font-semibold";
      return "bg-primary/30 text-primary-foreground";
    }

    return "bg-muted text-muted-foreground";
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick(schedule);
      }}
      className={cn(
        "text-xs px-2 py-1 rounded truncate cursor-pointer transition-all hover:scale-105 hover:shadow-md",
        getEventClasses()
      )}
      title={`${schedule.title} - ${schedule.maintenance_type} (${schedule.priority})`}
    >
      {schedule.title}
    </div>
  );
}
