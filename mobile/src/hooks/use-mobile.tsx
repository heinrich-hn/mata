/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { BREAKPOINTS, MOBILE_BREAKPOINT, type Breakpoint } from "@/constants/breakpoints";

// Re-export for convenience
export { BREAKPOINTS, type Breakpoint } from "@/constants/breakpoints";

// ============================================================================
// Constants
// ============================================================================
const BREAKPOINT_ORDER: (Breakpoint | "xs")[] = ["2xl", "xl", "lg", "md", "sm", "xs"];

// ============================================================================
// Core Hooks
// ============================================================================

/**
 * Hook to detect if the viewport is mobile-sized
 * Uses a debounced resize handler for better performance
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      // Debounce resize events for better performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }, 100);
    };

    // Initial check
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return isMobile;
}

/**
 * Hook to get the current breakpoint
 * Returns the largest breakpoint that matches
 * Uses ResizeObserver for better performance (falls back to resize event)
 */
export function useBreakpoint(): Breakpoint | "xs" {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint | "xs">("xs");

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId: number;
    let resizeObserver: ResizeObserver | null = null;

    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      // Use binary search-like approach for better performance
      if (width >= BREAKPOINTS["2xl"]) {
        setBreakpoint("2xl");
      } else if (width >= BREAKPOINTS.xl) {
        setBreakpoint("xl");
      } else if (width >= BREAKPOINTS.lg) {
        setBreakpoint("lg");
      } else if (width >= BREAKPOINTS.md) {
        setBreakpoint("md");
      } else if (width >= BREAKPOINTS.sm) {
        setBreakpoint("sm");
      } else {
        setBreakpoint("xs");
      }
    };

    // Use requestAnimationFrame to throttle updates
    const throttledUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateBreakpoint);
    };

    // Try to use ResizeObserver for better performance
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(throttledUpdate);
      resizeObserver.observe(document.documentElement);
    } else {
      window.addEventListener("resize", throttledUpdate);
    }

    // Initial update
    updateBreakpoint();

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", throttledUpdate);
      }
    };
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport is at or above a certain breakpoint
 * Memoized to prevent unnecessary re-renders
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = React.useState(false);
  const query = React.useMemo(() => `(min-width: ${BREAKPOINTS[breakpoint]}px)`, [breakpoint]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    
    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mql.matches);
    
    // Use addEventListener for better compatibility
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Hook to get responsive values based on current breakpoint
 * Enhanced with proper TypeScript inference and memoization
 *
 * @example
 * const columns = useResponsiveValue({
 *   xs: 1,
 *   sm: 2,
 *   md: 3,
 *   lg: 4,
 * });
 */
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint | "xs", T>>): T | undefined {
  const breakpoint = useBreakpoint();

  return React.useMemo(() => {
    const currentIndex = BREAKPOINT_ORDER.indexOf(breakpoint);
    
    // Find the value for current breakpoint or fall back to larger breakpoints
    for (let i = currentIndex; i < BREAKPOINT_ORDER.length; i++) {
      const bp = BREAKPOINT_ORDER[i];
      const value = values[bp];
      if (value !== undefined) {
        return value;
      }
    }
    
    // Fallback to any defined value
    return undefined;
  }, [breakpoint, values]);
}

/**
 * Hook that returns true if the device supports touch
 * Memoized result
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    
    const checkTouch = () => {
      return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE-specific
        navigator.msMaxTouchPoints > 0
      );
    };
    
    setIsTouch(checkTouch());
  }, []);

  return isTouch;
}

/**
 * Hook that returns true if the device is in portrait orientation
 * Includes orientation change detection
 */
export function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia("(orientation: portrait)");
    
    const onChange = (event: MediaQueryListEvent) => {
      setIsPortrait(event.matches);
    };

    setIsPortrait(mql.matches);
    mql.addEventListener("change", onChange);
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isPortrait;
}

/**
 * Hook that returns the current window dimensions
 * Useful for complex responsive logic
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = React.useState(() => {
    if (typeof window === "undefined") {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      // Debounce for performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return size;
}

/**
 * Hook-based visibility for when CSS isn't enough
 * Memoized to prevent unnecessary re-renders
 */
export function useResponsiveVisibility() {
  const isMobile = useIsMobile();
  const breakpoint = useBreakpoint();

  return React.useMemo(() => ({
    isMobile,
    isDesktop: !isMobile,
    isSmallScreen: breakpoint === "xs" || breakpoint === "sm",
    isMediumScreen: breakpoint === "md",
    isLargeScreen: breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl",
    breakpoint,
  }), [isMobile, breakpoint]);
}

// ============================================================================
// Advanced Hooks
// ============================================================================

/**
 * Hook to get the current orientation and dimensions
 * Combines orientation and size information
 */
export function useOrientation() {
  const isPortrait = useIsPortrait();
  const { width, height } = useWindowSize();

  return React.useMemo(() => ({
    isPortrait,
    isLandscape: !isPortrait,
    width,
    height,
    aspectRatio: width / height,
  }), [isPortrait, width, height]);
}

/**
 * Hook that returns true if the device is a mobile device with touch
 * Useful for mobile-specific interactions
 */
export function useIsMobileTouch(): boolean {
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();

  return isMobile && isTouch;
}

/**
 * Hook to detect if the viewport is at or below a certain breakpoint
 * Inverse of useMediaQuery
 */
export function useMaxMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = React.useState(false);
  const query = React.useMemo(() => `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`, [breakpoint]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(query);
    
    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Hook to conditionally render based on breakpoint
 * Returns the appropriate value for current breakpoint
 */
export function useBreakpointValue<T>(values: {
  base?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  "2xl"?: T;
}): T | undefined {
  const breakpoint = useBreakpoint();

  return React.useMemo(() => {
    const breakpoints: Record<string, T | undefined> = values;
    
    // Check exact breakpoint first
    if (breakpoints[breakpoint] !== undefined) {
      return breakpoints[breakpoint];
    }
    
    // Fall back to smaller breakpoints
    const order = ["2xl", "xl", "lg", "md", "sm", "base"];
    const currentIndex = order.indexOf(breakpoint === "xs" ? "base" : breakpoint);
    
    for (let i = currentIndex; i < order.length; i++) {
      const bp = order[i];
      const value = breakpoints[bp === "base" ? "base" : bp];
      if (value !== undefined) {
        return value;
      }
    }
    
    return breakpoints.base;
  }, [breakpoint, values]);
}

// ============================================================================
// SSR-safe utilities
// ============================================================================

/**
 * Check if code is running on the client side
 */
export const isClient = typeof window !== "undefined";

/**
 * SSR-safe window.matchMedia
 */
export function safeMatchMedia(query: string): MediaQueryList | null {
  if (!isClient) return null;
  return window.matchMedia(query);
}

/**
 * Debounced resize observer hook
 */
export function useDebouncedResize(delay: number = 200): { width: number; height: number } {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [debouncedSize, setDebouncedSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: NodeJS.Timeout;
    
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDebouncedSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, delay);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, [delay]);

  return debouncedSize;
}