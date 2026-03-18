// src/utils/tyre-utils.ts
import { PressureHealthStatus } from "@/types/tyre";

export const getPressureHealthStatus = (
  current: number,
  recommended: number,
  tolerance = 10
): PressureHealthStatus => {
  if (current < recommended * 0.7) return "critical";
  if (current < recommended - tolerance) return "low";
  if (current > recommended + tolerance) return "high";
  return "normal";
};