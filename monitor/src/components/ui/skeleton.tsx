import { cn } from "@/lib/utils";
import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional variant for different skeleton styles */
  variant?: "default" | "circular" | "text" | "card";
  /** Optional custom animation */
  animation?: "pulse" | "shimmer" | "none";
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "default", animation = "pulse", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-muted",
          // Variants
          variant === "circular" && "rounded-full",
          variant === "text" && "rounded h-4",
          variant === "card" && "rounded-lg",
          // Animations
          animation === "pulse" && "animate-pulse",
          animation === "shimmer" && "animate-shimmer",
          className
        )}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

/**
 * Alert Card Skeleton - Loading state for alert list items
 */
function AlertCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <div className="flex gap-3">
        {/* Severity indicator skeleton */}
        <Skeleton variant="circular" className="h-10 w-10 flex-shrink-0" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-3/4 h-4" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>

        {/* Right side skeleton */}
        <div className="flex flex-col items-end gap-2">
          <Skeleton variant="text" className="w-16 h-3" />
          <Skeleton variant="text" className="w-12 h-5" />
        </div>
      </div>

      {/* Expanded content skeleton */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        <Skeleton variant="text" className="w-full h-3" />
        <Skeleton variant="text" className="w-2/3 h-3" />
      </div>
    </div>
  );
}

/**
 * KPI Card Skeleton - Loading state for analytics cards
 */
function KPICardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton variant="circular" className="h-8 w-8" />
        <Skeleton variant="text" className="w-12 h-4" />
      </div>
      <Skeleton variant="text" className="w-20 h-8 mb-2" />
      <Skeleton variant="text" className="w-24 h-3" />
    </div>
  );
}

/**
 * Chart Skeleton - Loading state for analytics charts
 */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" className="w-32 h-5" />
        <Skeleton variant="text" className="w-16 h-4" />
      </div>
      <Skeleton variant="card" className="h-48 w-full" />
    </div>
  );
}

/**
 * Table Row Skeleton - Loading state for table rows
 */
function TableRowSkeleton({
  columns = 4,
  className
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-border", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton
            variant="text"
            className={cn(
              "h-4",
              // Vary widths for more realistic look
              i === 0 && "w-20",
              i === 1 && "w-32",
              i === 2 && "w-16",
              i === 3 && "w-24"
            )}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Table Skeleton - Loading state for tables
 */
function TableSkeleton({
  rows = 5,
  columns = 4,
  className
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-lg overflow-hidden", className)}>
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4 text-left">
                <Skeleton variant="text" className="w-20 h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * List Skeleton - Loading state for list items
 */
function ListSkeleton({
  items = 3,
  className
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 bg-card border border-border rounded-lg">
          <Skeleton variant="circular" className="h-8 w-8 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-1/3 h-4" />
            <Skeleton variant="text" className="w-2/3 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Filter Bar Skeleton - Loading state for filter components
 */
function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <div className="flex flex-wrap gap-3">
        <Skeleton variant="card" className="w-32 h-10" />
        <Skeleton variant="card" className="w-24 h-10" />
        <Skeleton variant="card" className="w-28 h-10" />
        <Skeleton variant="card" className="w-40 h-10" />
        <Skeleton variant="card" className="w-48 h-10 flex-1" />
      </div>
    </div>
  );
}

export {
  AlertCardSkeleton, ChartSkeleton, FilterBarSkeleton, KPICardSkeleton, ListSkeleton, Skeleton, TableRowSkeleton,
  TableSkeleton
};

