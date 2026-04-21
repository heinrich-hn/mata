import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import VehicleDocumentsSection from "@/components/Vehicle/VehicleDocumentsSection";

interface Vehicle {
  id: string;
  fleet_number: string | null;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  tonnage: number | null;
  engine_specs: string | null;
  active: boolean | null;
}

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
}

interface VehicleFormData {
  fleet_number: string;
  registration_number: string;
  make: string;
  model: string;
  vehicle_type: string;
  tonnage: string;
  vin_number: string;
  active: boolean;
}

const VEHICLE_TYPES = [
  { value: "rigid_truck", label: "Rigid Truck" },
  { value: "horse_truck", label: "Horse Truck" },
  { value: "refrigerated_truck", label: "Refrigerated Truck" },
  { value: "reefer", label: "Reefer Trailer" },
  { value: "interlink", label: "Interlink Trailer" },
  { value: "van", label: "Light Motor Vehicle" }, // Using 'van' for Light Motor Vehicle
];

const EditVehicleDialog = ({ open, onOpenChange, vehicle }: EditVehicleDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<VehicleFormData>({
    fleet_number: "",
    registration_number: "",
    make: "",
    model: "",
    vehicle_type: "",
    tonnage: "",
    vin_number: "",
    active: true,
  });

  useEffect(() => {
    if (vehicle) {
      setFormData({
        fleet_number: vehicle.fleet_number || "",
        registration_number: vehicle.registration_number,
        make: vehicle.make,
        model: vehicle.model,
        vehicle_type: vehicle.vehicle_type,
        tonnage: vehicle.tonnage?.toString() || "",
        vin_number: vehicle.engine_specs || "",
        active: vehicle.active ?? true,
      });
    }
  }, [vehicle]);

  const updateVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      if (!vehicle) throw new Error("No vehicle selected");

      const { data: updatedVehicle, error } = await supabase
        .from("vehicles")
        .update({
          fleet_number: data.fleet_number || null,
          registration_number: data.registration_number,
          make: data.make,
          model: data.model,
          vehicle_type: data.vehicle_type as Database["public"]["Enums"]["vehicle_type"],
          tonnage: data.tonnage ? parseFloat(data.tonnage) : null,
          engine_specs: data.vin_number || null,
          active: data.active,
        })
        .eq("id", vehicle.id)
        .select()
        .single();

      if (error) throw error;
      return updatedVehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.registration_number || !formData.make || !formData.model || !formData.vehicle_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    updateVehicleMutation.mutate(formData);
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vehicle</DialogTitle>
          <DialogDescription>
            Update vehicle information in the fleet management system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Fleet Number */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fleet_number" className="text-right">
                Fleet Number
              </Label>
              <Input
                id="fleet_number"
                value={formData.fleet_number}
                onChange={(e) =>
                  setFormData({ ...formData, fleet_number: e.target.value })
                }
                placeholder="e.g., 33H, 1T, 4F"
                className="col-span-3"
              />
            </div>

            {/* Registration Number */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="registration_number" className="text-right">
                Registration *
              </Label>
              <Input
                id="registration_number"
                value={formData.registration_number}
                onChange={(e) =>
                  setFormData({ ...formData, registration_number: e.target.value })
                }
                placeholder="e.g., JFK963FS"
                className="col-span-3"
                required
              />
            </div>

            {/* Make */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="make" className="text-right">
                Make *
              </Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) =>
                  setFormData({ ...formData, make: e.target.value })
                }
                placeholder="e.g., Volvo, Scania, Mercedes"
                className="col-span-3"
                required
              />
            </div>

            {/* Model */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model" className="text-right">
                Model *
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                placeholder="e.g., FH16, R450, Actros"
                className="col-span-3"
                required
              />
            </div>

            {/* Vehicle Type */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vehicle_type" className="text-right">
                Vehicle Type *
              </Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, vehicle_type: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tonnage */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tonnage" className="text-right">
                Tonnage
              </Label>
              <Input
                id="tonnage"
                type="number"
                step="0.1"
                value={formData.tonnage}
                onChange={(e) =>
                  setFormData({ ...formData, tonnage: e.target.value })
                }
                placeholder="e.g., 34"
                className="col-span-3"
              />
            </div>

            {/* VIN Number */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vin_number" className="text-right">
                VIN Number
              </Label>
              <Input
                id="vin_number"
                value={formData.vin_number}
                onChange={(e) =>
                  setFormData({ ...formData, vin_number: e.target.value })
                }
                placeholder="e.g., YV1AS565781234567"
                className="col-span-3"
              />
            </div>

            {/* Active Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="active" className="text-right">
                Status
              </Label>
              <Select
                value={formData.active ? "active" : "inactive"}
                onValueChange={(value) =>
                  setFormData({ ...formData, active: value === "active" })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Documents */}
            <VehicleDocumentsSection vehicleId={vehicle.id} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateVehicleMutation.isPending}>
              {updateVehicleMutation.isPending ? "Updating..." : "Update Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVehicleDialog;