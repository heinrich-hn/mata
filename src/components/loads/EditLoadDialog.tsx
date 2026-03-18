import { Button } from "@/components/ui/button";
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
import { useLoads } from "@/hooks/useLoads";
import type { Database } from "@/integrations/supabase/types";
import { useState } from "react";
import { ClientSelect } from "../ui/client-select";
import LocationSelector from "./LocationSelector";
import VehicleSelector from "./VehicleSelector";

type LoadInsert = Database["public"]["Tables"]["loads"]["Insert"];

interface CreateLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateLoadDialog = ({ open, onOpenChange }: CreateLoadDialogProps) => {
  const { createLoad } = useLoads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>("");
  const [assignImmediately, setAssignImmediately] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Reset form and close dialog
      setSelectedVehicleId(null);
      setSelectedVehicleName("");
      setAssignImmediately(false);
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
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create load:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h3 className="text-sm font-medium">Route Information</h3>
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
                  value={formData.origin_lat || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      origin_lat: parseFloat(e.target.value),
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
                  value={formData.origin_lng || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      origin_lng: parseFloat(e.target.value),
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
                  value={formData.destination_lat || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination_lat: parseFloat(e.target.value),
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
                  value={formData.destination_lng || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destination_lng: parseFloat(e.target.value),
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
                  value={formData.weight_kg || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weight_kg: parseFloat(e.target.value),
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
                  value={formData.volume_m3 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      volume_m3: parseFloat(e.target.value),
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
                  value={formData.quoted_price || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quoted_price: parseFloat(e.target.value),
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
