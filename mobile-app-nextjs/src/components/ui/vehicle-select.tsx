"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface VehicleSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface VehicleSelectProps {
  options: VehicleSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function VehicleSelect({
  options,
  value,
  onChange,
  placeholder = "Select a vehicle",
  disabled = false,
  className,
}: VehicleSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Track if the select is open (for styling)
  useEffect(() => {
    const handleBlur = () => setIsOpen(false);
    const select = selectRef.current;
    
    if (select) {
      select.addEventListener('blur', handleBlur);
      select.addEventListener('click', () => setIsOpen(!isOpen));
    }
    
    return () => {
      if (select) {
        select.removeEventListener('blur', handleBlur);
        select.removeEventListener('click', () => setIsOpen(!isOpen));
      }
    };
  }, [isOpen]);

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Truck className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      
      <select
        ref={selectRef}
        title="Select vehicle"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-12 pl-10 pr-10 rounded-lg appearance-none",
          "bg-card border border-border/50 ring-1 ring-border/50", // Solid background
          "text-sm font-medium transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          isOpen && "ring-2 ring-primary/30 border-primary/30"
        )}
        style={{
          // These styles help with option visibility in dark mode
          colorScheme: 'dark',
        }}
      >
        <option value="" disabled className="text-muted-foreground">
          {placeholder}
        </option>
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            className="bg-card text-foreground"
            style={{
              backgroundColor: 'hsl(230, 18%, 22%)', // Your card color
              color: 'hsl(0, 0%, 97%)', // Your foreground color
            }}
          >
            {option.label}{option.sublabel ? ` • ${option.sublabel}` : ""}
          </option>
        ))}
      </select>

      {/* Custom dropdown indicator */}
      <ChevronDown
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none transition-transform",
          isOpen && "transform rotate-180"
        )}
        strokeWidth={1.5}
      />

      {/* Selected value display enhancement */}
      {selectedOption && (
        <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 pointer-events-none truncate">
          <span className="text-xs text-muted-foreground/70 block truncate">
            {selectedOption.sublabel}
          </span>
        </div>
      )}
    </div>
  );
}

// Alternative: Custom dropdown implementation for full theme control
export function CustomVehicleSelect({
  options,
  value,
  onChange,
  placeholder = "Select a vehicle",
  disabled = false,
  className,
}: VehicleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full h-12 px-3 rounded-lg flex items-center gap-3",
          "bg-card border border-border/50 ring-1 ring-border/50",
          "text-sm font-medium transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          isOpen && "ring-2 ring-primary/30 border-primary/30"
        )}
      >
        <Truck className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        
        <div className="flex-1 text-left truncate">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="font-medium">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-muted-foreground/70">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
            isOpen && "transform rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 rounded-lg bg-card border border-border/50 shadow-xl max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left flex flex-col hover:bg-primary/10 focus:bg-primary/20 transition-colors",
                  option.value === value && "bg-primary/20"
                )}
              >
                <span className="text-sm font-medium">{option.label}</span>
                {option.sublabel && (
                  <span className="text-xs text-muted-foreground/70">
                    {option.sublabel}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}