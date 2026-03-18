// src/components/loads/calendar/CalendarHeader.tsx

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import type { CalendarView } from "./LoadPlanningCalendar";

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterCount: number;
}

export const CalendarHeader = ({
  currentDate,
  view,
  onViewChange,
  onNavigate,
  showFilters,
  onToggleFilters,
  filterCount,
}: CalendarHeaderProps) => {
  const formatTitle = () => {
    if (view === "month" || view === "allocation") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } else if (view === "week") {
      const start = getStartOfWeek(currentDate);
      const end = getEndOfWeek(currentDate);
      return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } else {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => onNavigate("today")}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onNavigate("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-2xl font-bold">{formatTitle()}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={onToggleFilters}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {filterCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 h-5 w-5 p-0 flex items-center justify-center"
            >
              {filterCount}
            </Badge>
          )}
        </Button>

        <Select
          value={view}
          onValueChange={(v) => onViewChange(v as CalendarView)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="allocation">Allocation</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

function getStartOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return start;
}

function getEndOfWeek(date: Date): Date {
  const end = new Date(date);
  const day = end.getDay();
  end.setDate(end.getDate() + (6 - day));
  return end;
}
