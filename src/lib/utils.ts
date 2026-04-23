import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as YYYY-MM-DD using LOCAL timezone components.
 *
 * Avoids the timezone bug from `date.toISOString().split("T")[0]`, which
 * converts to UTC and shifts the date by ±1 day for users not in UTC
 * (e.g. SAST UTC+2 turns April 26 00:00 local into "2026-04-25").
 */
export function formatLocalDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}