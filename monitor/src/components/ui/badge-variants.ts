// monitor/src/components/ui/badge-variants.ts
import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-border bg-secondary text-secondary-foreground",
        secondary:
          "border-border bg-muted text-muted-foreground",
        destructive:
          "border-danger/20 bg-danger-soft text-danger",
        outline: "border-border text-foreground",
        success:
          "border-success/20 bg-success-soft text-success",
        warning:
          "border-warning/20 bg-warning-soft text-warning",
        info:
          "border-info/20 bg-info-soft text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);