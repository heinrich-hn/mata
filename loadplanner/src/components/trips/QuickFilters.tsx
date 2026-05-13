import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  addWeeks,
  endOfWeek,
  format,
  getWeek,
  startOfWeek,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// Types
interface QuickFiltersProps {
  onSearch: (query: string) => void;
  onStatusFilter: (status: string) => void;
  onOriginFilter: (origin: string) => void;
  onWeekFilter?: (weekStart: Date | null, weekEnd: Date | null) => void;
}

interface WeekOption {
  value: string;
  label: string;
  weekNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isNext: boolean;
  isPast: boolean;
}

interface WeekInfoBadgeProps {
  week: WeekOption;
}

// Constants
const WEEK_OPTIONS_CONFIG = {
  weekStartsOn: 1 as const,
  firstWeekContainsDate: 4 as const
};

const FILTER_OPTIONS = {
  status: ['all', 'scheduled', 'in-transit', 'pending', 'delivered'] as const,
  origin: ['all', 'Harare', 'Bulawayo', 'Mutare'] as const,
} as const;

const ALL_WEEKS_VALUE = 'all';

// Utility functions
function generateWeekOptions(currentDate: Date = new Date()): WeekOption[] {
  const currentYear = currentDate.getFullYear();
  const currentWeekNumber = getWeek(currentDate, WEEK_OPTIONS_CONFIG);
  const jan4 = new Date(currentYear, 0, 4);
  const week1Start = startOfWeek(jan4, WEEK_OPTIONS_CONFIG);

  return Array.from({ length: 52 }, (_, index) => {
    const weekNum = index + 1;
    const weekStart = addWeeks(week1Start, weekNum - 1);
    const weekEnd = endOfWeek(weekStart, WEEK_OPTIONS_CONFIG);

    return {
      value: `week-${weekNum}`,
      label: `Week ${weekNum}`,
      weekNumber: weekNum,
      year: currentYear,
      startDate: weekStart,
      endDate: weekEnd,
      isCurrent: weekNum === currentWeekNumber,
      isNext: weekNum === currentWeekNumber + 1,
      isPast: weekNum < currentWeekNumber,
    };
  });
}

// Sub-components
function WeekInfoBadge({ week }: WeekInfoBadgeProps) {
  if (week.isCurrent) {
    return (
      <Badge className="bg-primary/10 text-primary border-0">
        This Week
      </Badge>
    );
  }

  if (week.isNext) {
    return (
      <Badge className="bg-accent/10 text-accent border-0">
        Upcoming
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">
      Past
    </Badge>
  );
}

function WeekSelectItem({ week }: { week: WeekOption }) {
  return (
    <SelectItem value={week.value}>
      <div className="flex items-center gap-2">
        <span className="tabular-nums w-16">{week.label}</span>
        <span className="text-xs text-muted-foreground">
          ({format(week.startDate, 'MMM d')})
        </span>
        {week.isCurrent && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-primary/10 text-primary">
            Current
          </Badge>
        )}
        {week.isNext && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-accent/10 text-accent">
            Next
          </Badge>
        )}
      </div>
    </SelectItem>
  );
}

function SelectedWeekInfo({ week }: { week: WeekOption }) {
  return (
    <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-background rounded-lg border">
      <div className="text-sm">
        <span className="text-muted-foreground">Date Range: </span>
        <span className="font-medium text-foreground">
          {format(week.startDate, 'MMM d')} - {format(week.endDate, 'MMM d, yyyy')}
        </span>
      </div>
      <WeekInfoBadge week={week} />
    </div>
  );
}

// Filter select component
interface FilterSelectProps {
  placeholder: string;
  options: readonly string[];
  onValueChange: (value: string) => void;
}

function FilterSelect({ placeholder, options, onValueChange }: FilterSelectProps) {
  const label = placeholder.charAt(0).toUpperCase() + placeholder.slice(1);

  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger className="w-[140px]">
        <Filter className="h-4 w-4 mr-2" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}s</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Main component
export function QuickFilters({
  onSearch,
  onStatusFilter,
  onOriginFilter,
  onWeekFilter
}: QuickFiltersProps) {
  const weekOptions = useMemo(() => generateWeekOptions(), []);
  const currentWeekOption = useMemo(
    () => weekOptions.find(w => w.isCurrent),
    [weekOptions]
  );

  const [selectedWeek, setSelectedWeek] = useState<string>(
    currentWeekOption?.value ?? ALL_WEEKS_VALUE
  );

  const selectedWeekData = useMemo(
    () => weekOptions.find(w => w.value === selectedWeek),
    [weekOptions, selectedWeek]
  );

  const currentWeekIndex = useMemo(
    () => weekOptions.findIndex(w => w.value === selectedWeek),
    [weekOptions, selectedWeek]
  );

  const isFirstWeek = currentWeekIndex === 0;
  const isLastWeek = currentWeekIndex === weekOptions.length - 1;

  const handleWeekChange = useCallback((value: string) => {
    setSelectedWeek(value);

    if (value === ALL_WEEKS_VALUE) {
      onWeekFilter?.(null, null);
      return;
    }

    const week = weekOptions.find(w => w.value === value);
    if (week) {
      onWeekFilter?.(week.startDate, week.endDate);
    }
  }, [weekOptions, onWeekFilter]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    if (currentWeekIndex === -1 && currentWeekOption) {
      handleWeekChange(currentWeekOption.value);
      return;
    }

    const newIndex = direction === 'prev' ? currentWeekIndex - 1 : currentWeekIndex + 1;
    if (newIndex >= 0 && newIndex < weekOptions.length) {
      handleWeekChange(weekOptions[newIndex].value);
    }
  }, [currentWeekIndex, currentWeekOption, weekOptions, handleWeekChange]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  }, [onSearch]);

  const handleClearWeek = useCallback(() => {
    handleWeekChange(ALL_WEEKS_VALUE);
  }, [handleWeekChange]);

  return (
    <div className="space-y-4" role="search" aria-label="Filter loads">
      {/* Week Selector */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-medium text-foreground">Week View</span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateWeek('prev')}
            disabled={isFirstWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={selectedWeek}
            onValueChange={handleWeekChange}
            aria-label="Select week"
          >
            <SelectTrigger className="w-[220px] bg-background">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value={ALL_WEEKS_VALUE}>
                <div className="flex items-center gap-2">
                  <span>All Weeks</span>
                </div>
              </SelectItem>
              {weekOptions.map((week) => (
                <WeekSelectItem key={week.value} week={week} />
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateWeek('next')}
            disabled={isLastWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {selectedWeekData && <SelectedWeekInfo week={selectedWeekData} />}

        {selectedWeek !== ALL_WEEKS_VALUE && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearWeek}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search loads by ID, driver, route..."
            className="pl-9 bg-background"
            onChange={handleSearch}
            aria-label="Search loads"
            type="search"
          />
        </div>
        <div className="flex gap-2">
          <FilterSelect
            placeholder="Status"
            options={FILTER_OPTIONS.status.filter(s => s !== 'all')}
            onValueChange={onStatusFilter}
          />
          <FilterSelect
            placeholder="Origin"
            options={FILTER_OPTIONS.origin.filter(o => o !== 'all')}
            onValueChange={onOriginFilter}
          />
        </div>
      </div>
    </div>
  );
}