import { useAlertFilters } from "@/hooks/useAlertFilters";
import { useVehicles } from "@/hooks/useVehicles";
import { useWialonVehicles } from "@/hooks/useWialonVehicles";
import { cn } from "@/lib/utils";
import type { AlertSeverity, AlertStatus } from "@/types";
import { ChevronDown, Filter, Search, Truck, X } from "lucide-react";
import { useState } from "react";

// Use the full return type from useAlertFilters
type FilterBarReturn = ReturnType<typeof useAlertFilters>;

/* Professional severity colors */
const SEVERITIES: { value: AlertSeverity; color: string; label: string }[] = [
  { value: "critical", color: "text-destructive bg-destructive/10 border-destructive/20", label: "Critical" },
  { value: "high", color: "text-severity-high bg-severity-high/10 border-severity-high/20", label: "High" },
  { value: "medium", color: "text-severity-medium bg-severity-medium/10 border-severity-medium/20", label: "Medium" },
  { value: "low", color: "text-severity-low bg-severity-low/10 border-severity-low/20", label: "Low" },
  { value: "info", color: "text-muted-foreground bg-muted border-border", label: "Info" },
];

const STATUSES: { value: AlertStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" }, // Removed "acknowledged"
];

interface Vehicle {
  id: string;
  name?: string;
  fleet_number?: string | null;
  registration?: string | null;
}

export default function AlertFilterBar(props: FilterBarReturn) {
  const {
    filters,
    toggleSeverity,
    toggleStatus,
    setSearchQuery,
    setVehicleFilter,
    toggleFleetFilter,
    clearVehicleFilters,
    resetFilters,
    activeFilterCount,
  } = props;

  const [searchValue, setSearchValue] = useState(filters.searchQuery);
  const [showVehicleFilters, setShowVehicleFilters] = useState(false);

  const { data: wialonVehicles = [], isLoading: loadingWialon } = useWialonVehicles();
  const { data: regularVehicles = [], isLoading: loadingRegular } = useVehicles();

  const allVehicles: Vehicle[] = [...wialonVehicles, ...regularVehicles];

  const fleets = [...new Set(
    allVehicles
      .map(v => v.fleet_number)
      .filter((fleet): fleet is string => fleet !== null && fleet !== undefined)
  )].sort();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setSearchQuery(e.target.value);
  };

  const handleSearchClear = () => {
    setSearchValue("");
    setSearchQuery("");
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setVehicleFilter(vehicleId);
    setShowVehicleFilters(false);
  };

  const handleFleetSelect = (fleetNumber: string) => {
    toggleFleetFilter(fleetNumber);
  };

  return (
    <div className="space-y-3 p-4 bg-card border border-border rounded-lg">
      {/* Row 1: Search + Vehicle Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search alerts…"
            value={searchValue}
            onChange={handleSearchChange}
            className="w-full bg-muted border border-border rounded-md pl-8 pr-8 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchValue && (
            <button
              onClick={handleSearchClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Vehicle Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowVehicleFilters(!showVehicleFilters)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors",
              filters.selectedVehicle || filters.selectedFleets.length > 0
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            )}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>
              {filters.selectedVehicle
                ? "1 Vehicle"
                : filters.selectedFleets.length > 0
                  ? `${filters.selectedFleets.length} Fleet${filters.selectedFleets.length > 1 ? 's' : ''}`
                  : "All Vehicles"}
            </span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {showVehicleFilters && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowVehicleFilters(false)}
              />

              <div className="absolute right-0 mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 p-2">
                <div className="space-y-2">
                  {(filters.selectedVehicle || filters.selectedFleets.length > 0) && (
                    <button
                      onClick={() => {
                        clearVehicleFilters();
                        setShowVehicleFilters(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-md"
                    >
                      Clear all vehicle filters
                    </button>
                  )}

                  {fleets.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                        Fleets
                      </div>
                      {fleets.map((fleet) => (
                        <button
                          key={fleet}
                          onClick={() => handleFleetSelect(fleet)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors",
                            filters.selectedFleets.includes(fleet)
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-accent"
                          )}
                        >
                          {fleet}
                        </button>
                      ))}
                    </div>
                  )}

                  {fleets.length > 0 && allVehicles.length > 0 && (
                    <div className="border-t border-border my-2" />
                  )}

                  {allVehicles.length > 0 && (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1 sticky top-0 bg-popover">
                        All Vehicles
                      </div>
                      {loadingWialon || loadingRegular ? (
                        <div className="text-xs text-muted-foreground px-2 py-1">
                          Loading vehicles...
                        </div>
                      ) : (
                        allVehicles.map((vehicle) => (
                          <button
                            key={vehicle.id}
                            onClick={() => handleVehicleSelect(vehicle.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors",
                              filters.selectedVehicle === vehicle.id
                                ? "bg-primary/20 text-primary"
                                : "hover:bg-accent"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {vehicle.fleet_number || vehicle.name || 'Unknown'}
                              </span>
                              {vehicle.registration && (
                                <span className="text-muted-foreground">
                                  ({vehicle.registration})
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Filter className="h-3 w-3" />
            Reset ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Row 2: Severity filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Severity:</span>
        {SEVERITIES.map((sev) => (
          <button
            key={sev.value}
            onClick={() => toggleSeverity(sev.value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
              filters.severities.includes(sev.value)
                ? sev.color + " opacity-100"
                : "text-muted-foreground bg-transparent border-border opacity-60 hover:opacity-100"
            )}
          >
            {sev.label}
          </button>
        ))}

        <span className="text-xs text-muted-foreground ml-4">Status:</span>
        {STATUSES.map((st) => (
          <button
            key={st.value}
            onClick={() => toggleStatus(st.value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
              filters.statuses.includes(st.value)
                ? st.value === "active"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                : "text-muted-foreground bg-transparent border-border opacity-60 hover:opacity-100"
            )}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Row 3: Active filters display */}
      {(filters.selectedVehicle || filters.selectedFleets.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">Active vehicle filters:</span>
          {filters.selectedVehicle && (
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              Vehicle: {allVehicles.find(v => v.id === filters.selectedVehicle)?.fleet_number ||
                allVehicles.find(v => v.id === filters.selectedVehicle)?.name ||
                'Selected'}
            </span>
          )}
          {filters.selectedFleets.map((fleet) => (
            <span
              key={fleet}
              className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
            >
              Fleet: {fleet}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}