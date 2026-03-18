import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extractRegistrationNumber, getFleetConfig } from "@/constants/fleetTyreConfig";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

type InstalledTyre = Database["public"]["Tables"]["tyres"]["Row"] & {
  vehicles?: {
    id: string;
    registration_number: string;
    fleet_number: string;
    current_odometer: number | null;
  } | null;
};

interface EditInstalledTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tyre: InstalledTyre | null;
  onUpdate: () => void;
}

const EditInstalledTyreDialog = ({ open, onOpenChange, tyre, onUpdate }: EditInstalledTyreDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    size: "",
    type: "",
    serial_number: "",
    position: "",
    installation_date: "",
    installation_km: "",
    current_tread_depth: "",
    condition: "",
    notes: "",
    vehicle_id: "",
    fleet_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [availablePositions, setAvailablePositions] = useState<{ position: string; label: string }[]>([]);

  // Fetch vehicles for selection
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_for_edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, registration_number, fleet_number")
        .order("fleet_number");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Populate form when tyre changes
  useEffect(() => {
    if (tyre && open) {
      // Parse current_fleet_position to get position code (e.g., "33H JFK963FS-V3" -> "V3")
      const positionMatch = tyre.current_fleet_position?.match(/-([A-Z0-9]+)$/);
      const positionCode = positionMatch ? positionMatch[1] : "";

      // Get fleet number from the position string
      const fleetMatch = tyre.current_fleet_position?.match(/^(\d+[A-Z]+)\s/);
      const fleetNumber = fleetMatch ? fleetMatch[1] : tyre.vehicles?.fleet_number || "";

      setFormData({
        brand: tyre.brand || "",
        model: tyre.model || "",
        size: tyre.size || "",
        type: tyre.type || "",
        serial_number: tyre.serial_number || "",
        position: positionCode,
        installation_date: tyre.installation_date || "",
        installation_km: tyre.installation_km?.toString() || "",
        current_tread_depth: tyre.current_tread_depth?.toString() || "",
        condition: tyre.condition || "good",
        notes: tyre.notes || "",
        vehicle_id: tyre.vehicles?.id || "",
        fleet_number: fleetNumber,
      });

      // Set available positions based on fleet config
      if (fleetNumber) {
        const config = getFleetConfig(fleetNumber);
        if (config) {
          setAvailablePositions(config.positions);
        }
      }
    }
  }, [tyre, open]);

  // Update available positions when fleet number changes
  useEffect(() => {
    if (formData.fleet_number) {
      const config = getFleetConfig(formData.fleet_number);
      if (config) {
        setAvailablePositions(config.positions);
      } else {
        setAvailablePositions([]);
      }
    }
  }, [formData.fleet_number]);

  // Update fleet number when vehicle changes
  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setFormData(prev => ({
        ...prev,
        vehicle_id: vehicleId,
        fleet_number: vehicle.fleet_number || "",
      }));
    }
  };

  const handleSubmit = async () => {
    if (!tyre) return;

    setLoading(true);
    try {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      if (!vehicle) {
        throw new Error("Please select a vehicle");
      }

      // Build the new current_fleet_position string
      const registrationNo = extractRegistrationNumber(vehicle.registration_number);
      const newFleetPosition = `${formData.fleet_number} ${vehicle.registration_number}-${formData.position}`;

      // Update the tyre record
      const { error: tyreError } = await supabase
        .from("tyres")
        .update({
          brand: formData.brand,
          model: formData.model,
          size: formData.size,
          type: formData.type,
          serial_number: formData.serial_number || null,
          position: formData.position,
          current_fleet_position: newFleetPosition,
          installation_date: formData.installation_date || null,
          installation_km: formData.installation_km ? parseInt(formData.installation_km) : null,
          current_tread_depth: formData.current_tread_depth ? parseFloat(formData.current_tread_depth) : null,
          condition: formData.condition as Database["public"]["Enums"]["tyre_condition"],
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tyre.id);

      if (tyreError) throw tyreError;

      // Update fleet_tyre_positions table if position changed
      const oldPositionMatch = tyre.current_fleet_position?.match(/-([A-Z0-9]+)$/);
      const oldPosition = oldPositionMatch ? oldPositionMatch[1] : "";
      const oldFleetMatch = tyre.current_fleet_position?.match(/^(\d+[A-Z]+)\s/);
      const oldFleetNumber = oldFleetMatch ? oldFleetMatch[1] : "";
      const oldRegMatch = tyre.current_fleet_position?.match(/^(\d+[A-Z]+)\s+([A-Z0-9/\s]+)-([A-Z0-9]+)$/);
      const oldRegistration = oldRegMatch ? oldRegMatch[2].trim() : "";

      // If position or vehicle changed, update fleet_tyre_positions
      if (oldPosition !== formData.position || oldFleetNumber !== formData.fleet_number || oldRegistration !== vehicle.registration_number) {
        // Clear old position
        if (oldFleetNumber && oldRegistration && oldPosition) {
          await supabase
            .from("fleet_tyre_positions")
            .update({ tyre_code: null, updated_at: new Date().toISOString() })
            .eq("fleet_number", oldFleetNumber)
            .eq("registration_no", extractRegistrationNumber(oldRegistration))
            .eq("position", oldPosition);
        }

        // Set new position
        const { data: existingPosition } = await supabase
          .from("fleet_tyre_positions")
          .select("id")
          .eq("fleet_number", formData.fleet_number)
          .eq("registration_no", registrationNo)
          .eq("position", formData.position)
          .maybeSingle();

        if (existingPosition) {
          await supabase
            .from("fleet_tyre_positions")
            .update({ tyre_code: tyre.id, updated_at: new Date().toISOString() })
            .eq("id", existingPosition.id);
        } else {
          await supabase
            .from("fleet_tyre_positions")
            .insert({
              fleet_number: formData.fleet_number,
              registration_no: registrationNo,
              position: formData.position,
              vehicle_id: vehicle.id,
              tyre_code: tyre.id,
            });
        }

        // Add position history record
        await supabase
          .from("tyre_position_history")
          .insert({
            tyre_id: tyre.id,
            vehicle_id: vehicle.id,
            fleet_position: newFleetPosition,
            action: "moved",
            from_position: tyre.current_fleet_position || null,
            to_position: newFleetPosition,
            km_reading: formData.installation_km ? parseInt(formData.installation_km) : 0,
            performed_by: "System",
            notes: `Position updated from ${tyre.current_fleet_position || 'unknown'} to ${newFleetPosition}`,
          });
      }

      toast({
        title: "Success",
        description: "Installed tyre updated successfully",
      });
      requestGoogleSheetsSync('tyres');

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update tyre";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Installed Tyre</DialogTitle>
          <DialogDescription>
            Update the tyre details, position, or installation information
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Tyre Details Section */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Tyre Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Enter brand"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Enter model"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="e.g., 295/80R22.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steer">Steer</SelectItem>
                    <SelectItem value="drive">Drive</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
          </div>

          {/* Position Section */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">Position & Vehicle</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle</Label>
                <Select
                  value={formData.vehicle_id}
                  onValueChange={handleVehicleChange}
                >
                  <SelectTrigger id="vehicle">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.fleet_number} - {vehicle.registration_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Select
                  value={formData.position}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                  disabled={availablePositions.length === 0}
                >
                  <SelectTrigger id="position">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePositions.map((pos) => (
                      <SelectItem key={pos.position} value={pos.position}>
                        {pos.position} - {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Installation Details Section */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm text-muted-foreground">Installation Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installation_date">Installation Date</Label>
                <Input
                  id="installation_date"
                  type="date"
                  value={formData.installation_date}
                  onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installation_km">Installation KM</Label>
                <Input
                  id="installation_km"
                  type="number"
                  value={formData.installation_km}
                  onChange={(e) => setFormData({ ...formData, installation_km: e.target.value })}
                  placeholder="Enter km reading"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_tread_depth">Current Tread Depth (mm)</Label>
                <Input
                  id="current_tread_depth"
                  type="number"
                  step="0.1"
                  value={formData.current_tread_depth}
                  onChange={(e) => setFormData({ ...formData, current_tread_depth: e.target.value })}
                  placeholder="Enter tread depth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger id="condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditInstalledTyreDialog;