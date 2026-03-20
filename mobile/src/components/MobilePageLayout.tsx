import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MobilePageLayoutProps {
  children: ReactNode;
  /**
   * Whether to show a back button in the header
   */
  showBackButton?: boolean;
  /**
   * Custom header content
   */
  header?: ReactNode;
  /**
   * Page title for the header
   */
  title?: string;
  /**
   * Whether to show the bottom safe area padding
   */
  withSafeBottom?: boolean;
  /**
   * Whether to show the top safe area padding
   */
  withSafeTop?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Custom className for the content
   */
  contentClassName?: string;
  /**
   * Background color variant
   */
  variant?: "default" | "subtle" | "surface";
  /**
   * Whether to enable pull-to-refresh (experimental)
   */
  enablePullToRefresh?: boolean;
  /**
   * Callback when pull-to-refresh is triggered
   */
  onRefresh?: () => Promise<void>;
  /**
   * Whether the layout is loading
   */
  loading?: boolean;
}

/**
 * Mobile page wrapper with safe area handling, scrolling, and mobile-optimized layout.
 * Provides consistent spacing and handles iOS notch, home indicator, and keyboard avoidance.
 */
const MobilePageLayout = ({ 
  children, 
  showBackButton = false,
  header,
  title,
  withSafeBottom = true,
  withSafeTop = true,
  className,
  contentClassName,
  variant = "default",
  enablePullToRefresh = false,
  onRefresh,
  loading = false,
}: MobilePageLayoutProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  // Background variants
  const bgVariants = {
    default: "bg-background",
    subtle: "bg-muted/30",
    surface: "bg-surface",
  };

  // Pull-to-refresh logic
  useEffect(() => {
    if (!enablePullToRefresh || !onRefresh) return;

    let touchStartY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
        setStartY(touchStartY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - touchStartY);
      
      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, 100));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 50 && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      setPullDistance(0);
      isPulling = false;
    };

    const container = document.getElementById("mobile-layout-scroll");
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, { passive: false });
      container.addEventListener("touchmove", handleTouchMove, { passive: false });
      container.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [enablePullToRefresh, onRefresh, pullDistance, isRefreshing]);

  return (
    <div className={cn(
      "min-h-[100dvh] bg-background",
      bgVariants[variant],
      className
    )}>
      {/* Header */}
      {(header || title || showBackButton) && (
        <div className={cn(
          "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
          withSafeTop && "safe-area-top"
        )}>
          <div className="max-w-2xl mx-auto px-4">
            {header ? (
              header
            ) : (
              <div className="flex items-center h-14 gap-3">
                {showBackButton && (
                  <button
                    onClick={() => window.history.back()}
                    className="touch-target -ml-2 w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent active:bg-accent/70 transition-colors"
                    aria-label="Go back"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                )}
                {title && (
                  <h1 className="text-xl font-semibold flex-1 truncate">
                    {title}
                  </h1>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content with scroll container */}
      <div
        id="mobile-layout-scroll"
        className={cn(
          "overflow-y-auto overscroll-contain",
          "webkit-overflow-scrolling-touch",
          withSafeBottom && "safe-area-bottom",
          contentClassName
        )}
        style={{
          height: "calc(100dvh - var(--header-height, 0px))",
          ...(enablePullToRefresh && {
            overscrollBehavior: "contain",
          }),
        }}
      >
        {/* Pull-to-refresh indicator */}
        {enablePullToRefresh && pullDistance > 0 && (
          <div 
            className="flex justify-center items-center transition-all duration-200"
            style={{ 
              height: `${pullDistance}px`,
              transform: `translateY(${Math.min(pullDistance * 0.5, 30)}px)`,
            }}
          >
            <div className={cn(
              "w-8 h-8 rounded-full border-2 border-primary border-t-transparent",
              isRefreshing && "animate-spin"
            )} />
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className={cn("max-w-2xl mx-auto px-4 py-4", withSafeBottom && "pb-safe-bottom")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobilePageLayout;