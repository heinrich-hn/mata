/* eslint-disable react-refresh/only-export-components */
import * as React from "react";

import { BREAKPOINTS, MOBILE_BREAKPOINT, type Breakpoint } from "@/constants/breakpoints";

// Re-export for convenience
export { BREAKPOINTS, type Breakpoint } from "@/constants/breakpoints";

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Hook to get the current breakpoint
 * Returns the largest breakpoint that matches
 */
export function useBreakpoint(): Breakpoint | "xs" {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint | "xs">("xs");

  React.useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
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

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport is at or above a certain breakpoint
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
    const mql = window.matchMedia(query);

    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);

    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return matches;
}

/**
 * Hook to get responsive values based on current breakpoint
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

  // Find the value for current breakpoint or fall back to smaller breakpoints
  const breakpointOrder: (Breakpoint | "xs")[] = ["2xl", "xl", "lg", "md", "sm", "xs"];
  const currentIndex = breakpointOrder.indexOf(breakpoint);

  for (let i = currentIndex; i < breakpointOrder.length; i++) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }

  return undefined;
}

/**
 * Hook that returns true if the device supports touch
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is IE-specific
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Hook that returns true if the device is in portrait orientation
 */
export function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = React.useState(true);

  React.useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    const onChange = () => setIsPortrait(mql.matches);
    mql.addEventListener("change", onChange);
    setIsPortrait(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isPortrait;
}

/**
 * Hook-based visibility for when CSS isn't enough
 */
export function useResponsiveVisibility() {
  const isMobile = useIsMobile();
  const breakpoint = useBreakpoint();

  return {
    isMobile,
    isDesktop: !isMobile,
    isSmallScreen: breakpoint === "xs" || breakpoint === "sm",
    isLargeScreen: breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl",
    breakpoint,
  };
}