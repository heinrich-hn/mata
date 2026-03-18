"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useCallback, useRef, useState } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);

    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto h-full", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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