import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string | number;
  color?: string;
}

interface FilterConfig {
  id: string;
  label: string;
  type: "select" | "multi-select" | "date-range" | "text";
  options?: FilterOption[];
  placeholder?: string;
  defaultValue?: string | string[];
}

interface DateRangeValue {
  start?: string | null;
  end?: string | null;
}

type FilterValue = string | string[] | DateRangeValue | undefined;

interface FilterProps {
  config: FilterConfig;
  value: FilterValue;
  onValueChange: (value: FilterValue) => void;
  onRemove?: () => void;
  className?: string;
}

const Filter: React.FC<FilterProps> = ({ config, value, onValueChange, onRemove, className }) => {
  const renderFilterContent = () => {
    switch (config.type) {
      case "select":
        return (
          <Select
            value={value as string || ''}
            onValueChange={(newValue) => onValueChange(newValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={config.placeholder} />
            </SelectTrigger>
            <SelectContent className="w-[300px]">
              {config.options?.map((option) => (
                <SelectItem key={option.value.toString()} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multi-select": {
        // For multi-select, we need a different approach since Select doesn't support multiple natively
        // This is a simplified version - you might want to use a different component for multi-select
        const selectedValues = Array.isArray(value) ? value : [];

        return (
          <div className="flex flex-wrap gap-2">
            <Select
              value=""
              onValueChange={(newValue) => {
                if (newValue && !selectedValues.includes(newValue)) {
                  onValueChange([...selectedValues, newValue]);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={config.placeholder || "Select options"} />
              </SelectTrigger>
              <SelectContent className="w-[300px]">
                {config.options?.map((option) => (
                  <SelectItem
                    key={option.value.toString()}
                    value={option.value.toString()}
                    disabled={selectedValues.includes(option.value.toString())}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedValues.map((val) => {
                  const option = config.options?.find(opt => opt.value.toString() === val);
                  return (
                    <div
                      key={val}
                      className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                    >
                      <span>{option?.label || val}</span>
                      <button
                        onClick={() => onValueChange(selectedValues.filter(v => v !== val))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case "date-range": {
        const dateValue = (value as DateRangeValue) || {};
        return (
          <div className="flex gap-2">
            <DatePicker
              value={dateValue.start ? new Date(dateValue.start) : undefined}
              onChange={(date) => onValueChange({
                ...dateValue,
                start: date ? date.toISOString().split('T')[0] : null
              })}
              placeholder="Start date"
            />
            <DatePicker
              value={dateValue.end ? new Date(dateValue.end) : undefined}
              onChange={(date) => onValueChange({
                ...dateValue,
                end: date ? date.toISOString().split('T')[0] : null
              })}
              placeholder="End date"
            />
          </div>
        );
      }

      case "text":
        return (
          <Input
            value={value as string || ''}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={config.placeholder}
            className="w-full"
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${className || ''}`}>
      <span className="text-sm font-medium text-muted-foreground">{config.label}:</span>
      <div className="flex-1 min-w-0">{renderFilterContent()}</div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="p-1 h-8 w-8"
          aria-label="Remove filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default Filter;