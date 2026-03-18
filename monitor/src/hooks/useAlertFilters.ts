import { useState, useCallback } from "react";
import { subHours, subDays } from "date-fns";
import type { AlertFilters, AlertSeverity, AlertCategory, AlertSourceType, AlertStatus } from "@/types";

const DEFAULT_FILTERS: AlertFilters = {
  timeRange: "last24h",
  startDate: subHours(new Date(), 24),
  endDate: new Date(),
  severities: [],
  categories: [],
  sourceTypes: [],
  statuses: ["active"],
  searchQuery: "",
  selectedVehicle: null,
  selectedFleets: [],
};

function getDateRange(range: AlertFilters["timeRange"]): { startDate: Date; endDate: Date } {
  const now = new Date();
  switch (range) {
    case "last1h": return { startDate: subHours(now, 1), endDate: now };
    case "last6h": return { startDate: subHours(now, 6), endDate: now };
    case "last24h": return { startDate: subHours(now, 24), endDate: now };
    case "last7d": return { startDate: subDays(now, 7), endDate: now };
    case "last30d": return { startDate: subDays(now, 30), endDate: now };
    default: return { startDate: subHours(now, 24), endDate: now };
  }
}

export function useAlertFilters() {
  const [filters, setFilters] = useState<AlertFilters>({
    ...DEFAULT_FILTERS,
    ...getDateRange("last24h"),
  });

  const setTimeRange = useCallback((range: AlertFilters["timeRange"]) => {
    if (range === "custom") {
      setFilters((f) => ({ ...f, timeRange: "custom" }));
    } else {
      setFilters((f) => ({ ...f, timeRange: range, ...getDateRange(range) }));
    }
  }, []);

  const setCustomDateRange = useCallback((startDate: Date, endDate: Date) => {
    setFilters((f) => ({ ...f, timeRange: "custom", startDate, endDate }));
  }, []);

  const toggleSeverity = useCallback((severity: AlertSeverity) => {
    setFilters((f) => ({
      ...f,
      severities: f.severities.includes(severity)
        ? f.severities.filter((s) => s !== severity)
        : [...f.severities, severity],
    }));
  }, []);

  const toggleCategory = useCallback((category: AlertCategory) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(category)
        ? f.categories.filter((c) => c !== category)
        : [...f.categories, category],
    }));
  }, []);

  const toggleSourceType = useCallback((sourceType: AlertSourceType) => {
    setFilters((f) => ({
      ...f,
      sourceTypes: f.sourceTypes.includes(sourceType)
        ? f.sourceTypes.filter((s) => s !== sourceType)
        : [...f.sourceTypes, sourceType],
    }));
  }, []);

  const toggleStatus = useCallback((status: AlertStatus) => {
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(status)
        ? f.statuses.filter((s) => s !== status)
        : [...f.statuses, status],
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((f) => ({ ...f, searchQuery: query }));
  }, []);

  // New vehicle/fleet filter functions
  const setVehicleFilter = useCallback((vehicleId: string | null) => {
    setFilters((f) => ({
      ...f,
      selectedVehicle: vehicleId,
      selectedFleets: vehicleId ? [] : f.selectedFleets,
    }));
  }, []);

  const toggleFleetFilter = useCallback((fleetNumber: string) => {
    setFilters((f) => ({
      ...f,
      selectedFleets: f.selectedFleets.includes(fleetNumber)
        ? f.selectedFleets.filter((fNum) => fNum !== fleetNumber)
        : [...f.selectedFleets, fleetNumber],
      selectedVehicle: null,
    }));
  }, []);

  const clearVehicleFilters = useCallback(() => {
    setFilters((f) => ({
      ...f,
      selectedVehicle: null,
      selectedFleets: [],
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, ...getDateRange("last24h") });
  }, []);

  const activeFilterCount =
    filters.severities.length +
    filters.categories.length +
    filters.sourceTypes.length +
    (filters.statuses.length === 1 && filters.statuses[0] === "active" ? 0 : filters.statuses.length) +
    (filters.searchQuery ? 1 : 0) +
    (filters.selectedVehicle ? 1 : 0) +
    filters.selectedFleets.length;

  return {
    filters,
    setTimeRange,
    setCustomDateRange,
    toggleSeverity,
    toggleCategory,
    toggleSourceType,
    toggleStatus,
    setSearchQuery,
    setVehicleFilter,
    toggleFleetFilter,
    clearVehicleFilters,
    resetFilters,
    activeFilterCount,
  };
}