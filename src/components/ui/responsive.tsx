/* eslint-disable react-refresh/only-export-components */
import type { Breakpoint } from "@/constants/breakpoints";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  /** Maximum width constraint */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "none";
  /** Padding on mobile vs desktop */
  padding?: "none" | "sm" | "md" | "lg";
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
  none: "",
};

const paddingClasses = {
  none: "",
  sm: "px-4 md:px-6",
  md: "px-4 md:px-8",
  lg: "px-4 md:px-8 lg:px-12",
};

/**
 * Responsive container with sensible padding defaults
 */
export function ResponsiveContainer({
  children,
  className,
  maxWidth = "2xl",
  padding = "md",
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  /** Number of columns at each breakpoint */
  cols?: Partial<Record<Breakpoint | "xs", number>>;
  gap?: "none" | "sm" | "md" | "lg" | "xl";
}

const gapClasses = {
  none: "gap-0",
  sm: "gap-2 md:gap-3",
  md: "gap-3 md:gap-4",
  lg: "gap-4 md:gap-6",
  xl: "gap-6 md:gap-8",
};

/**
 * Responsive grid with configurable columns per breakpoint
 */
export function ResponsiveGrid({
  children,
  className,
  cols = { xs: 1, sm: 2, lg: 3, xl: 4 },
  gap = "md",
}: ResponsiveGridProps) {
  const colClasses = [
    cols.xs && `grid-cols-${cols.xs}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    cols["2xl"] && `2xl:grid-cols-${cols["2xl"]}`,
  ].filter(Boolean).join(" ");

  return (
    <div className={cn("grid", colClasses, gapClasses[gap], className)}>
      {children}
    </div>
  );
}

interface ShowProps {
  children: ReactNode;
  /** Show only on these breakpoints and above */
  above?: Breakpoint;
  /** Show only on these breakpoints and below */
  below?: Breakpoint;
}

/**
 * Conditionally show content based on breakpoint
 *
 * @example
 * <Show above="md">Desktop content</Show>
 * <Show below="md">Mobile content</Show>
 */
export function Show({ children, above, below }: ShowProps) {
  if (above) {
    return <div className={`hidden ${above}:block`}>{children}</div>;
  }
  if (below) {
    return <div className={`${below}:hidden`}>{children}</div>;
  }
  return <>{children}</>;
}

/**
 * Show content only on mobile
 */
export function MobileOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("md:hidden", className)}>{children}</div>;
}

/**
 * Show content only on desktop
 */
export function DesktopOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hidden md:block", className)}>{children}</div>;
}

interface ResponsiveStackProps {
  children: ReactNode;
  className?: string;
  /** Direction on mobile */
  mobileDirection?: "row" | "col";
  /** Direction on desktop */
  desktopDirection?: "row" | "col";
  gap?: "none" | "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

/**
 * Flex stack that changes direction based on viewport
 */
export function ResponsiveStack({
  children,
  className,
  mobileDirection = "col",
  desktopDirection = "row",
  gap = "md",
  align = "stretch",
  justify = "start",
}: ResponsiveStackProps) {
  const directionClasses = {
    row: "flex-row",
    col: "flex-col",
  };

  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };

  return (
    <div
      className={cn(
        "flex",
        directionClasses[mobileDirection],
        `md:${directionClasses[desktopDirection]}`,
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Responsive text that scales with viewport
 */
export function ResponsiveText({
  children,
  className,
  as: Component = "span",
  size = "base",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}) {
  const sizeClasses = {
    xs: "text-xs",
    sm: "text-xs sm:text-sm",
    base: "text-sm sm:text-base",
    lg: "text-base sm:text-lg",
    xl: "text-lg sm:text-xl",
    "2xl": "text-xl sm:text-2xl",
    "3xl": "text-2xl sm:text-3xl",
    "4xl": "text-3xl sm:text-4xl",
  };

  return (
    <Component className={cn(sizeClasses[size], className)}>
      {children}
    </Component>
  );
}

// Re-export hook from hooks module for convenience
export { useResponsiveVisibility } from "@/hooks/use-mobile";
