"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Truck } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button-variants";

// Button Props - exported inline is fine
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// Button component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Vehicle Select Types
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

// Native select version
export function VehicleSelect({
  options,
  value,
  onChange,
  placeholder = "Select a vehicle",
  disabled = false,
  className,
}: VehicleSelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const select = selectRef.current;
    if (!select) return;

    const handleClick = () => {
      setIsOpen((prev) => !prev);
    };

    const handleBlur = () => {
      setIsOpen(false);
    };

    select.addEventListener('mousedown', handleClick);
    select.addEventListener('blur', handleBlur);
    
    return () => {
      select.removeEventListener('mousedown', handleClick);
      select.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <Truck className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      
      <select
        ref={selectRef}
        title="Select vehicle"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full h-12 pl-10 pr-10 rounded-lg appearance-none cursor-pointer",
          "bg-card border border-border/50 ring-1 ring-border/50",
          "text-sm font-medium transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground/70",
          isOpen && "ring-2 ring-primary/30 border-primary/30"
        )}
        style={{ colorScheme: 'dark' }}
      >
        <option value="" disabled className="text-muted-foreground">
          {placeholder}
        </option>
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            className="bg-card text-foreground"
          >
            {option.label}{option.sublabel ? ` • ${option.sublabel}` : ""}
          </option>
        ))}
      </select>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
          strokeWidth={1.5}
        />
      </div>

      {selectedOption?.sublabel && (
        <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 pointer-events-none truncate z-20">
          <span className="text-xs text-muted-foreground/70 block truncate">
            {selectedOption.sublabel}
          </span>
        </div>
      )}
    </div>
  );
}

// Custom dropdown version
export function CustomVehicleSelect({
  options,
  value,
  onChange,
  placeholder = "Select a vehicle",
  disabled = false,
  className,
}: VehicleSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedOption = options.find((opt) => opt.value === value);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => prev < options.length - 1 ? prev + 1 : prev);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onChange(options[focusedIndex].value);
            setIsOpen(false);
            setFocusedIndex(-1);
            buttonRef.current?.focus();
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          buttonRef.current?.focus();
          break;
        case 'Tab':
          setIsOpen(false);
          setFocusedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options, focusedIndex, onChange]);

  React.useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex(opt => opt.value === value);
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      
      setTimeout(() => {
        if (selectedIndex >= 0 && optionRefs.current[selectedIndex]) {
          optionRefs.current[selectedIndex]?.focus();
        } else if (optionRefs.current[0]) {
          optionRefs.current[0]?.focus();
        }
      }, 50);
    }
  }, [isOpen, options, value]);

  const setOptionRef = (index: number) => (el: HTMLButtonElement | null) => {
    optionRefs.current[index] = el;
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!disabled) setIsOpen(true);
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select vehicle"
        className={cn(
          "w-full h-12 px-3 rounded-lg flex items-center gap-3",
          "bg-card border border-border/50 ring-1 ring-border/50",
          "text-sm font-medium transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground/70",
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
            <span className="text-muted-foreground/70">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "transform rotate-180"
          )}
          strokeWidth={1.5}
        />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 py-1 rounded-lg bg-card border border-border/50 shadow-xl max-h-60 overflow-auto"
          role="listbox"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              No options available
            </div>
          ) : (
            options.map((option, index) => (
              <button
                key={option.value}
                ref={setOptionRef(index)}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={focusedIndex === index ? 0 : -1}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                onFocus={() => setFocusedIndex(index)}
                className={cn(
                  "w-full px-3 py-2 text-left flex flex-col outline-none",
                  "transition-colors duration-150",
                  "hover:bg-primary/10",
                  focusedIndex === index && "bg-primary/20 ring-1 ring-primary/50",
                  option.value === value && "bg-primary/20",
                  "focus:bg-primary/20 focus:ring-1 focus:ring-primary/50"
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

// Export Button component only - types are already exported with their declarations
export { Button };