import { Button } from "@/components/ui/button";
import { ClientSelect } from "@/components/ui/client-select";
import
  {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast"; // Added for toast notifications
import { useLoads } from "@/hooks/useLoads";
import { useSavedRoutes } from "@/hooks/useSavedRoutes";
import type { Database } from "@/integrations/supabase/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import LocationSelector from "./LocationSelector";
import VehicleSelector from "./VehicleSelector";

type LoadInsert = Database["public"]["Tables"]["loads"]["Insert"];

interface CreateLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateLoadDialog = ({ open, onOpenChange }: CreateLoadDialogProps) => {
  const { toast } = useToast(); // Added
  const { createLoad } = useLoads();
  const { routes: savedRoutes = [] } = useSavedRoutes();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>("");
  const [assignImmediately, setAssignImmediately] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [searchRoute, setSearchRoute] = useState(""); // Added for route search

  const [formData, setFormData] = useState<Partial<LoadInsert>>({
    customer_name: undefined as string | undefined,
    contact_person: "",
    contact_phone: "",
    origin: "",
    origin_lat: null,
    origin_lng: null,
    destination: "",
    destination_lat: null,
    destination_lng: null,
    pickup_datetime: new Date().toISOString(),
    delivery_datetime: null,
    expected_arrival_at_pickup: null,
    expected_departure_from_pickup: null,
    expected_arrival_at_delivery: null,
    expected_departure_from_delivery: null,
    cargo_type: "",
    special_instructions: null,
    weight_kg: 0,
    volume_m3: null,
    special_requirements: null,
    quoted_price: null,
    currency: "ZAR",
    priority: "medium",
    status: "pending",
  });

  // Filtered saved routes based on search
  const filteredSavedRoutes = useMemo(() => {
    if (!searchRoute) return savedRoutes;
    const lower = searchRoute.toLowerCase();
    return savedRoutes.filter((route) =>
      route.name.toLowerCase().includes(lower) ||
      route.id.includes(searchRoute) ||
      route.waypoints.some((wp) => wp.name.toLowerCase().includes(lower))
    );
  }, [savedRoutes, searchRoute]);

  // Reset form and states when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedVehicleId(null);
      setSelectedVehicleName("");
      setAssignImmediately(false);
      setSelectedRouteId(null);
      setSearchRoute("");
      setFormData({
        customer_name: undefined,
        contact_person: "",
        contact_phone: "",
        origin: "",
        origin_lat: null,
        origin_lng: null,
        destination: "",
        destination_lat: null,
        destination_lng: null,
        pickup_datetime: new Date().toISOString(),
        delivery_datetime: null,
        expected_arrival_at_pickup: null,
        expected_departure_from_pickup: null,
        expected_arrival_at_delivery: null,
        expected_departure_from_delivery: null,
        cargo_type: "",
        special_instructions: null,
        weight_kg: 0,
        volume_m3: null,
        special_requirements: null,
        quoted_price: null,
        currency: "ZAR",
        priority: "medium",
        status: "pending",
      });
    }
  }, [open]);

  // Auto-set expected times based on pickup/delivery (optional UX improvement)
  useEffect(() => {
    if (formData.pickup_datetime && !formData.expected_arrival_at_pickup) {
      setFormData((prev) => ({
        ...prev,
        expected_arrival_at_pickup: prev.pickup_datetime,
      }));
    }
    if (formData.delivery_datetime && !formData.expected_arrival_at_delivery) {
      setFormData((prev) => ({
        ...prev,
        expected_arrival_at_delivery: prev.delivery_datetime,
      }));
    }
  }, [formData.pickup_datetime, formData.delivery_datetime, formData.expected_arrival_at_pickup, formData.expected_arrival_at_delivery]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name) {
      toast({
        title: "Missing required field",
        description: "Please select a customer name.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      // Generate load number (format: LD-YYYYMMDD-XXX)
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const loadNumber = `LD-${dateStr}-${randomNum}`;

      const loadData: LoadInsert = {
        load_number: loadNumber,
        customer_name: formData.customer_name || "",
        contact_person: formData.contact_person || null,
        contact_phone: formData.contact_phone || null,
        origin: formData.origin || "",
        origin_lat: formData.origin_lat || null,
        origin_lng: formData.origin_lng || null,
        destination: formData.destination || "",
        destination_lat: formData.destination_lat || null,
        destination_lng: formData.destination_lng || null,
        pickup_datetime: formData.pickup_datetime || new Date().toISOString(),
        delivery_datetime: formData.delivery_datetime || null,
        expected_arrival_at_pickup: formData.expected_arrival_at_pickup || null,
        expected_departure_from_pickup: formData.expected_departure_from_pickup || null,
        expected_arrival_at_delivery: formData.expected_arrival_at_delivery || null,
        expected_departure_from_delivery: formData.expected_departure_from_delivery || null,
        cargo_type: formData.cargo_type || "",
        special_instructions: formData.special_instructions || null,
        weight_kg: formData.weight_kg || 0,
        volume_m3: formData.volume_m3 || null,
        special_requirements: formData.special_requirements || null,
        quoted_price: formData.quoted_price || null,
        currency: (formData.currency || "ZAR") as "ZAR" | "USD" | "EUR",
        priority: (formData.priority || "medium") as
          | "low"
          | "medium"
          | "high"
          | "urgent",
        status: assignImmediately && selectedVehicleId ? "assigned" : "pending",
        assigned_vehicle_id: assignImmediately ? selectedVehicleId : null,
      };

      await createLoad(loadData);

      toast({
        title: "Success",
        description: `Load ${loadNumber} created successfully.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create load:", error);
      toast({
        title: "Error",
        description: "Failed to create load. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, assignImmediately, selectedVehicleId, createLoad, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Load</DialogTitle>
          <DialogDescription>
            Add a new shipment to the system. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <ClientSelect
                  value={formData.customer_name}
                  onValueChange={(value) => setFormData({ ...formData, customer_name: value })}
                  placeholder="Select or create customer"
                />
              </div>
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  type="text"
                  value={formData.contact_person || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_person: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_phone: e.target.value })
                  }
                  placeholder="+27 11 123 4567"
                />
              </div>
            </div>
          </div>

          {/* Route Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Route Information</h3>
              {savedRoutes.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {savedRoutes.length} saved route{savedRoutes.length !== 1 ? 's' : ''} available
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  No saved routes available
                </span>
              )}
            </div>
            {savedRoutes.length > 0 && (
              <div>
                <Label htmlFor="route_search">Search Saved Routes</Label>
                <Input
                  id="route_search"
                  placeholder="Search by name or waypoint..."
                  value={searchRoute}
                  onChange={(e) => setSearchRoute(e.target.value)}
                  className="mb-2"
                />
                <Select
                  value={selectedRouteId || ""}
                  onValueChange={(value) => {
                    setSelectedRouteId(value);
                    const route = savedRoutes.find(r => r.id === value);
                    if (route && route.waypoints.length >= 2) {
                      const pickupWaypoint = route.waypoints.find(wp => wp.type === 'pickup') || route.waypoints[0];
                      const deliveryWaypoint = route.waypoints.find(wp => wp.type === 'delivery') || route.waypoints[route.waypoints.length - 1];

                      setFormData({
                        ...formData,
                        origin: pickupWaypoint.name,
                        origin_lat: pickupWaypoint.latitude,
                        origin_lng: pickupWaypoint.longitude,
                        destination: deliveryWaypoint.name,
                        destination_lat: deliveryWaypoint.latitude,
                        destination_lng: deliveryWaypoint.longitude,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="📍 Load from saved route..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10000] max-h-60 overflow-y-auto">
                    {filteredSavedRoutes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{route.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {route.total_distance_km} km · {route.waypoints.length} stops · {route.estimated_duration_mins} mins
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="origin">Origin *</Label>
                <div className="space-y-2">
                  <LocationSelector
                    placeholder="Select origin from library..."
                    onSelect={(location) => {
                      setFormData({
                        ...formData,
                        origin: location.name,
                        origin_lat: location.latitude,
                        origin_lng: location.longitude,
                      });
                    }}
                  />
                  <Input
                    id="origin"
                    required
                    value={formData.origin || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, origin: e.target.value })
                    }
                    placeholder="Or type manually: Johannesburg, Gauteng"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="origin_lat">Origin Latitude</Label>
                <Input
                  id="origin_lat"
                  type="number"
                  step="0.000001"
                  value={formData.origin_lat ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      origin_lat: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="-26.2041"
                />
              </div>
              <div>
                <Label htmlFor="origin_lng">Origin Longitude</Label>
                <Input
                  id="origin_lng"
                  type="number"
                  step="0.000001"
                  value={formData.origin_lng ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      origin_lng: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="28.0473"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="destination">Destination *</Label>
                <div className="space-y-2">
                  <LocationSelector
                    placeholder="Select destination from library..."
                    onSelect={(location) => {
                      setFormData({
                        ...formData,
                        destination: location.name,
                        destination_lat: location.latitude,
                        destination_lng: location.longitude,
                      });
                    }}
                  />
                  <Input
                    id="destination"
                    required
                    value={formData.destination || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, destination: e.target.value })
                    }
                    placeholder="Or type manually: Cape Town, Western Cape"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="destination_lat">Destination Latitude</Label>
                <Input
                  id="destination_lat"
                  type="number"
                  step="0.000001"
                  value={formData.destination_lat ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination_lat: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="-33.9249"
                />
              </div>
              <div>
                <Label htmlFor="destination_lng">Destination Longitude</Label>
                <Input
                  id="destination_lng"
                  type="number"
                  step="0.000001"
                  value={formData.destination_lng ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination_lng: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="18.4241"
                />
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Timing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pickup_datetime">Pickup Date & Time *</Label>
                <Input
                  id="pickup_datetime"
                  type="datetime-local"
                  required
                  value={formData.pickup_datetime?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, pickup_datetime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="delivery_datetime">Delivery Date & Time</Label>
                <Input
                  id="delivery_datetime"
                  type="datetime-local"
                  value={formData.delivery_datetime?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delivery_datetime: e.target.value,
                    })
                  }
                />
              </div>

              {/* Expected arrival/departure times for loading */}
              <div>
                <Label htmlFor="expected_arrival_at_pickup">
                  Expected Arrival at Loading Point
                </Label>
                <Input
                  id="expected_arrival_at_pickup"
                  type="datetime-local"
                  value={formData.expected_arrival_at_pickup?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_arrival_at_pickup: e.target.value || null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled time to arrive at origin for loading
                </p>
              </div>
              <div>
                <Label htmlFor="expected_departure_from_pickup">
                  Expected Departure from Loading Point
                </Label>
                <Input
                  id="expected_departure_from_pickup"
                  type="datetime-local"
                  value={formData.expected_departure_from_pickup?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_departure_from_pickup: e.target.value || null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled time to depart after loading complete
                </p>
              </div>

              {/* Expected arrival/departure times for delivery */}
              <div>
                <Label htmlFor="expected_arrival_at_delivery">
                  Expected Arrival at Delivery Point
                </Label>
                <Input
                  id="expected_arrival_at_delivery"
                  type="datetime-local"
                  value={formData.expected_arrival_at_delivery?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_arrival_at_delivery: e.target.value || null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled time to arrive at destination
                </p>
              </div>
              <div>
                <Label htmlFor="expected_departure_from_delivery">
                  Expected Departure from Delivery Point
                </Label>
                <Input
                  id="expected_departure_from_delivery"
                  type="datetime-local"
                  value={formData.expected_departure_from_delivery?.slice(0, 16) || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_departure_from_delivery: e.target.value || null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduled time to depart after offloading complete
                </p>
              </div>
            </div>
          </div>

          {/* Cargo Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Cargo Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="cargo_type">Cargo Type *</Label>
                <Input
                  id="cargo_type"
                  required
                  value={formData.cargo_type || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cargo_type: e.target.value })
                  }
                  placeholder="e.g., Palletized Goods, Bulk Cement"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="special_instructions">Special Instructions</Label>
                <Textarea
                  id="special_instructions"
                  value={formData.special_instructions || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      special_instructions: e.target.value,
                    })
                  }
                  placeholder="Detailed cargo description and special instructions..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="weight_kg">Weight (kg) *</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.weight_kg ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weight_kg: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="15000"
                />
              </div>
              <div>
                <Label htmlFor="volume_m3">Volume (m³)</Label>
                <Input
                  id="volume_m3"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.volume_m3 ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      volume_m3: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="30"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="special_requirements">
                  Special Requirements (comma-separated)
                </Label>
                <Input
                  id="special_requirements"
                  value={formData.special_requirements?.join(", ") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      special_requirements: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s),
                    })
                  }
                  placeholder="e.g., Refrigerated, Fragile, Hazmat"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Priority */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Pricing & Priority</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quoted_price">Quoted Price</Label>
                <Input
                  id="quoted_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.quoted_price ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quoted_price: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="25000"
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency || "ZAR"}
                  onValueChange={(value: "ZAR" | "USD" | "EUR" | "GBP" | "BWP" | "ZMW") =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZAR">ZAR (South African Rand)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                    <SelectItem value="BWP">BWP (Botswana Pula)</SelectItem>
                    <SelectItem value="ZMW">ZMW (Zambian Kwacha)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select
                  value={formData.priority || "medium"}
                  onValueChange={(value: "low" | "medium" | "high" | "urgent") =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Vehicle Assignment (Optional) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Vehicle Assignment (Optional)</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignImmediately}
                  onChange={(e) => setAssignImmediately(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Assign vehicle now
              </label>
            </div>
            {assignImmediately && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <VehicleSelector
                  onSelect={(vehicleId, vehicleName) => {
                    setSelectedVehicleId(vehicleId);
                    setSelectedVehicleName(vehicleName);
                  }}
                  selectedVehicleId={selectedVehicleId || undefined}
                  showGPSOnly={true}
                  originLat={formData.origin_lat || undefined}
                  originLng={formData.origin_lng || undefined}
                />
                {selectedVehicleName && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ Selected: {selectedVehicleName}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Load"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLoadDialog;
