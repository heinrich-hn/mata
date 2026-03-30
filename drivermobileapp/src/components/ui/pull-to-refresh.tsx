import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;
const REFRESH_TIMEOUT_MS = 10_000;

/** Walk up the DOM to find the nearest ancestor with overflow-y scroll/auto. */
function getScrollParent(node: HTMLElement): HTMLElement {
  let parent = node.parentElement;
  while (parent && parent !== document.documentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  // Keep refs in sync so native listener closures always see latest values
  isRefreshingRef.current = isRefreshing;
  onRefreshRef.current = onRefresh;

  // Attach touch handlers to the nearest scrollable ancestor (MobileShell's
  // <main>). PullToRefresh itself is NOT a scroll container — that eliminates
  // nested-scroll-container bugs that freeze scrolling on mobile WebKit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollEl = getScrollParent(el);

    // Non-passive handler — only attached when we might need to intercept
    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);

      if (distance > 0 && scrollEl.scrollTop === 0) {
        e.preventDefault();
        const capped = Math.min(distance * 0.5, THRESHOLD * 1.5);
        pullDistanceRef.current = capped;
        setPullDistance(capped);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (scrollEl.scrollTop <= 0 && !isRefreshingRef.current) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
        scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
      }
    };

    const onTouchEnd = async () => {
      // Always remove the non-passive handler so normal scrolling stays fast
      scrollEl.removeEventListener("touchmove", onTouchMove);

      isPulling.current = false;
      const dist = pullDistanceRef.current;
      pullDistanceRef.current = 0;
      setPullDistance(0);

      if (dist >= THRESHOLD && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        try {
          await Promise.race([
            onRefreshRef.current(),
            new Promise<void>((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
          ]);
        } catch (err) {
          console.error("Pull-to-refresh error:", err);
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        }
      }
    };

    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(className)}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "flex items-center justify-center transition-all duration-200 overflow-hidden",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{ height: isRefreshing ? 40 : pullDistance }}
      >
        <div
          className={cn(
            "w-5 h-5 border-2 border-primary border-t-transparent rounded-full",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: isRefreshing ? "none" : `rotate(${pullDistance * 2}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}