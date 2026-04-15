import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface RefreshButtonProps {
    onRefresh: () => Promise<void>;
    className?: string;
    /** Size variant. Default "sm" */
    size?: "sm" | "md";
}

/**
 * Compact refresh button with spin animation while refreshing.
 * Intended for page headers — mirrors PullToRefresh behaviour.
 */
export function RefreshButton({ onRefresh, className, size = "sm" }: RefreshButtonProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleClick = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } catch (err) {
            console.error("Refresh error:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const iconSize = size === "md" ? "w-4.5 h-4.5" : "w-4 h-4";
    const padSize = size === "md" ? "p-2.5" : "p-2";

    return (
        <button
            onClick={handleClick}
            disabled={isRefreshing}
            aria-label="Refresh"
            className={cn(
                padSize,
                "rounded-xl bg-muted/60 text-muted-foreground active:scale-95 transition-all duration-200",
                "hover:bg-muted hover:text-foreground",
                "disabled:opacity-50",
                className,
            )}
        >
            <RefreshCw
                className={cn(iconSize, isRefreshing && "animate-spin")}
                strokeWidth={2}
            />
        </button>
    );
}
