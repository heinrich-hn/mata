import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DialogHeroProps {
    /** Lucide icon rendered inside the branded badge beside the title. */
    icon: LucideIcon;
    title: React.ReactNode;
    description?: React.ReactNode;
    className?: string;
    /** Optional content rendered to the right of the title block (e.g. a badge). */
    actions?: React.ReactNode;
}

/**
 * Standardised dialog header with a branded icon badge beside the title.
 *
 * Provides a single, consistent visual treatment for every dialog across the
 * app. Purely presentational — it composes the existing Dialog primitives and
 * carries no behaviour of its own.
 */
export function DialogHero({ icon: Icon, title, description, className, actions }: DialogHeroProps) {
    return (
        <DialogHeader className={cn("space-y-3", className)}>
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1 text-left">
                    <DialogTitle className="text-lg">{title}</DialogTitle>
                    {description ? <DialogDescription>{description}</DialogDescription> : null}
                </div>
                {actions}
            </div>
        </DialogHeader>
    );
}
