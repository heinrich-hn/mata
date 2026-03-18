// src/components/loads/calendar/CalendarFilters.tsx

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { CalendarFilters as FilterType } from "./LoadPlanningCalendar";

interface CalendarFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

interface VehicleRow {
  id: string;
  fleet_number: string | null;
}

export const CalendarFilters = ({
  filters,
  onFiltersChange,
}: CalendarFiltersProps) => {
  // Fetch vehicles for filter options
  const { data: vehicles = [] } = useQuery<VehicleRow[]>({
    queryKey: ["wialon-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wialon_vehicles")
        .select("id, fleet_number")
        .order("fleet_number");

      if (error) throw error;
      return data || [];
    },
  });

  const eventTypes = [
    { value: "pickup", label: "Pickup" },
    { value: "delivery", label: "Delivery" },
    { value: "maintenance", label: "Maintenance" },
    { value: "blocked", label: "Blocked" },
  ];

  const handleVehicleToggle = (vehicleId: string) => {
    const newVehicleIds = filters.vehicleIds.includes(vehicleId)
      ? filters.vehicleIds.filter((id) => id !== vehicleId)
      : [...filters.vehicleIds, vehicleId];

    onFiltersChange({ ...filters, vehicleIds: newVehicleIds });
  };

  const handleEventTypeToggle = (eventType: string) => {
    const newEventTypes = filters.eventTypes.includes(eventType)
      ? filters.eventTypes.filter((t) => t !== eventType)
      : [...filters.eventTypes, eventType];

    onFiltersChange({ ...filters, eventTypes: newEventTypes });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      vehicleIds: [],
      eventTypes: [],
      searchTerm: "",
    });
  };

  const hasActiveFilters =
    filters.vehicleIds.length > 0 ||
    filters.eventTypes.length > 0 ||
    filters.searchTerm.length > 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search loads, vehicles..."
              value={filters.searchTerm}
              onChange={(e) =>
                onFiltersChange({ ...filters, searchTerm: e.target.value })
              }
            />
          </div>

          {/* Event Types */}
          <div className="space-y-2">
            <Label>Event Types</Label>
            <div className="space-y-2">
              {eventTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`event-${type.value}`}
                    checked={filters.eventTypes.includes(type.value)}
                    onCheckedChange={() => handleEventTypeToggle(type.value)}
                  />
                  <label
                    htmlFor={`event-${type.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {type.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicles */}
          <div className="space-y-2">
            <Label>Vehicles</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`vehicle-${vehicle.id}`}
                    checked={filters.vehicleIds.includes(vehicle.id)}
                    onCheckedChange={() => handleVehicleToggle(vehicle.id)}
                  />
                  <label
                    htmlFor={`vehicle-${vehicle.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {vehicle.fleet_number ?? `Vehicle ${vehicle.id}`}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Clear all filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
