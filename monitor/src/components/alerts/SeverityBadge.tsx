import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/types";

interface SeverityBadgeProps {
  severity: AlertSeverity;
  size?: "sm" | "md";
  dot?: boolean;
}

/* Professional severity colors - muted and business-appropriate */
const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; classes: string; dot: string }> = {
  critical: {
    label: "CRITICAL",
    classes: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive"
  },
  high: {
    label: "HIGH",
    classes: "bg-severity-high/10 text-severity-high border-severity-high/20",
    dot: "bg-severity-high"
  },
  medium: {
    label: "MEDIUM",
    classes: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
    dot: "bg-severity-medium"
  },
  low: {
    label: "LOW",
    classes: "bg-severity-low/10 text-severity-low border-severity-low/20",
    dot: "bg-severity-low"
  },
  info: {
    label: "INFO",
    classes: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground"
  },
};

function SeverityBadge({ severity, size = "sm", dot = false }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold border rounded uppercase tracking-wide",
        config.classes,
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      )}
    >
      {dot && (
        <span
          className={cn(
            "rounded-full flex-shrink-0",
            config.dot,
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            severity === "critical" && "animate-pulse"
          )}
        />
      )}
      {config.label}
    </span>
  );
}

export default SeverityBadge;
export { SEVERITY_CONFIG };
