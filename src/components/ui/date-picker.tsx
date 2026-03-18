import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import * as React from "react";
import { Button } from "./button";

export interface DatePickerProps {
  /** The selected date value */
  value?: Date | string | null;
  /** Callback when date changes */
  onChange?: (date: Date | undefined) => void;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Format string for displaying the date */
  dateFormat?: string;
  /** Whether to show a clear button */
  clearable?: boolean;
  /** Minimum date allowed */
  minDate?: Date;
  /** Maximum date allowed */
  maxDate?: Date;
  /** ID for accessibility */
  id?: string;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "Select date",
      disabled = false,
      className,
      dateFormat = "PPP",
      clearable = true,
      minDate,
      maxDate,
      id,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    // Convert string to Date if needed, handling timezone correctly
    const dateValue = React.useMemo(() => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      // Parse date string as local date, not UTC
      // "2026-01-27" should be interpreted as Jan 27 local time, not UTC
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
      onChange?.(date);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(undefined);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateValue && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              {dateValue ? format(dateValue, dateFormat) : placeholder}
            </span>
            {clearable && dateValue && !disabled && (
              <X
                className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DatePicker.displayName = "DatePicker";

export interface DateRangePickerProps {
  /** The selected date range */
  value?: { from?: Date; to?: Date };
  /** Callback when date range changes */
  onChange?: (range: { from?: Date; to?: Date } | undefined) => void;
  /** Placeholder text when no range is selected */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name for the trigger button */
  className?: string;
  /** Format string for displaying dates */
  dateFormat?: string;
  /** Whether to show a clear button */
  clearable?: boolean;
  /** Number of months to show */
  numberOfMonths?: number;
}

const DateRangePicker = React.forwardRef<HTMLButtonElement, DateRangePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "Select date range",
      disabled = false,
      className,
      dateFormat = "LLL dd, y",
      clearable = true,
      numberOfMonths = 2,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(undefined);
    };

    const displayText = React.useMemo(() => {
      if (!value?.from) return null;
      if (value.to) {
        return `${format(value.from, dateFormat)} - ${format(value.to, dateFormat)}`;
      }
      return format(value.from, dateFormat);
    }, [value, dateFormat]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !displayText && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">
              {displayText || placeholder}
            </span>
            {clearable && displayText && !disabled && (
              <X
                className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value?.from ? { from: value.from, to: value.to } : undefined}
            onSelect={onChange}
            numberOfMonths={numberOfMonths}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DateRangePicker.displayName = "DateRangePicker";

export { DatePicker, DateRangePicker };