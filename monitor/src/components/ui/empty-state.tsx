import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Optional secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Variant style */
  variant?: "default" | "success" | "warning" | "error";
  /** Additional className */
  className?: string;
}

/**
 * Empty State Component - Informative display when no content is available
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  const variantStyles = {
    default: {
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
    },
    success: {
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
    },
    warning: {
      iconBg: "bg-yellow-500/10",
      iconColor: "text-yellow-500",
    },
    error: {
      iconBg: "bg-red-500/10",
      iconColor: "text-red-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center mb-4",
          styles.iconBg
        )}
      >
        <Icon className={cn("w-8 h-8", styles.iconColor)} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant="outline"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Empty State for Alerts - Specific empty state for alert list
 */
interface AlertsEmptyStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

export function AlertsEmptyState({
  hasFilters = false,
  onClearFilters,
  className,
}: AlertsEmptyStateProps) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={SearchX}
        title="No alerts found"
        description="No alerts match your current filters. Try adjusting your search criteria."
        action={
          onClearFilters
            ? {
              label: "Clear filters",
              onClick: onClearFilters,
            }
            : undefined
        }
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={CheckCircle}
      title="All clear!"
      description="No active alerts at this time. You're all caught up."
      variant="success"
      className={className}
    />
  );
}

/**
 * Empty State for Tables - When no data in table
 */
interface TableEmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function TableEmptyState({
  title = "No data available",
  description = "There are no records to display at this time.",
  action,
  className,
}: TableEmptyStateProps) {
  return (
    <EmptyState
      icon={Table2}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

/**
 * Empty State for Search - When search returns no results
 */
interface SearchEmptyStateProps {
  query: string;
  onClearSearch?: () => void;
  className?: string;
}

export function SearchEmptyState({
  query,
  onClearSearch,
  className,
}: SearchEmptyStateProps) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find anything matching "${query}"`}
      action={
        onClearSearch
          ? {
            label: "Clear search",
            onClick: onClearSearch,
          }
          : undefined
      }
      className={className}
    />
  );
}

/**
 * Empty State for Loading - Initial loading state
 */
interface LoadingEmptyStateProps {
  message?: string;
  className?: string;
}

export function LoadingEmptyState({
  message = "Loading...",
  className,
}: LoadingEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Import the icons we need
import { CheckCircle, Search, SearchX, Table2 } from "lucide-react";

