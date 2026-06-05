// monitor/src/components/ui/badge.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
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

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// Attach the variants to the component
Badge.variants = badgeVariants;

export { Badge };