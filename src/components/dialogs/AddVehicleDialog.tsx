import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getFleetConfig, type FleetConfig, type FleetTyrePosition } from "@/constants/fleetTyreConfig";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import VehicleDocumentsSection, { type PendingDocument } from "@/components/Vehicle/VehicleDocumentsSection";

// Default tyre position templates based on vehicle type
const TYRE_TEMPLATES: Record<string, { label: string; positions: FleetTyrePosition[]; fleetType: FleetConfig['fleetType'] }> = {
  horse_10: {
    label: "Horse (10 wheels + spare)",
    fleetType: 'horse',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear 1 Left Outer', axle: 'Rear 1' },
      { position: 'V4', label: 'V4 - Rear 1 Left Inner', axle: 'Rear 1' },
      { position: 'V5', label: 'V5 - Rear 1 Right Inner', axle: 'Rear 1' },
      { position: 'V6', label: 'V6 - Rear 1 Right Outer', axle: 'Rear 1' },
      { position: 'V7', label: 'V7 - Rear 2 Left Outer', axle: 'Rear 2' },
      { position: 'V8', label: 'V8 - Rear 2 Left Inner', axle: 'Rear 2' },
      { position: 'V9', label: 'V9 - Rear 2 Right Inner', axle: 'Rear 2' },
      { position: 'V10', label: 'V10 - Rear 2 Right Outer', axle: 'Rear 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  horse_6: {
    label: "Horse (6 wheels + spare)",
    fleetType: 'horse',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left Outer', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Left Inner', axle: 'Rear' },
      { position: 'V5', label: 'V5 - Rear Right Inner', axle: 'Rear' },
      { position: 'V6', label: 'V6 - Rear Right Outer', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  trailer_6: {
    label: "Trailer (6 wheels + spare)",
    fleetType: 'trailer',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Right', axle: 'Axle 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  trailer_8: {
    label: "Trailer (8 wheels + spare)",
    fleetType: 'trailer',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  reefer_8: {
    label: "Reefer (8 wheels + spare)",
    fleetType: 'reefer',
    positions: [
      { position: 'T1', label: 'T1 - Axle 1 Left Outer', axle: 'Axle 1' },
      { position: 'T2', label: 'T2 - Axle 1 Left Inner', axle: 'Axle 1' },
      { position: 'T3', label: 'T3 - Axle 1 Right Inner', axle: 'Axle 1' },
      { position: 'T4', label: 'T4 - Axle 1 Right Outer', axle: 'Axle 1' },
      { position: 'T5', label: 'T5 - Axle 2 Left Outer', axle: 'Axle 2' },
      { position: 'T6', label: 'T6 - Axle 2 Left Inner', axle: 'Axle 2' },
      { position: 'T7', label: 'T7 - Axle 2 Right Inner', axle: 'Axle 2' },
      { position: 'T8', label: 'T8 - Axle 2 Right Outer', axle: 'Axle 2' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
  interlink_18: {
    label: "Interlink (16 wheels + 2 spares)",
    fleetType: 'trailer',
    positions: [
      // Front Trailer - Axle 1
      { position: 'T1', label: 'T1 - Front Trailer Axle 1 Left Outer', axle: 'Front Axle 1' },
      { position: 'T2', label: 'T2 - Front Trailer Axle 1 Left Inner', axle: 'Front Axle 1' },
      { position: 'T3', label: 'T3 - Front Trailer Axle 1 Right Inner', axle: 'Front Axle 1' },
      { position: 'T4', label: 'T4 - Front Trailer Axle 1 Right Outer', axle: 'Front Axle 1' },
      // Front Trailer - Axle 2
      { position: 'T5', label: 'T5 - Front Trailer Axle 2 Left Outer', axle: 'Front Axle 2' },
      { position: 'T6', label: 'T6 - Front Trailer Axle 2 Left Inner', axle: 'Front Axle 2' },
      { position: 'T7', label: 'T7 - Front Trailer Axle 2 Right Inner', axle: 'Front Axle 2' },
      { position: 'T8', label: 'T8 - Front Trailer Axle 2 Right Outer', axle: 'Front Axle 2' },
      // Rear Trailer - Axle 1
      { position: 'T9', label: 'T9 - Rear Trailer Axle 1 Left Outer', axle: 'Rear Axle 1' },
      { position: 'T10', label: 'T10 - Rear Trailer Axle 1 Left Inner', axle: 'Rear Axle 1' },
      { position: 'T11', label: 'T11 - Rear Trailer Axle 1 Right Inner', axle: 'Rear Axle 1' },
      { position: 'T12', label: 'T12 - Rear Trailer Axle 1 Right Outer', axle: 'Rear Axle 1' },
      // Rear Trailer - Axle 2
      { position: 'T13', label: 'T13 - Rear Trailer Axle 2 Left Outer', axle: 'Rear Axle 2' },
      { position: 'T14', label: 'T14 - Rear Trailer Axle 2 Left Inner', axle: 'Rear Axle 2' },
      { position: 'T15', label: 'T15 - Rear Trailer Axle 2 Right Inner', axle: 'Rear Axle 2' },
      { position: 'T16', label: 'T16 - Rear Trailer Axle 2 Right Outer', axle: 'Rear Axle 2' },
      // Spares
      { position: 'SP1', label: 'SP1 - Spare 1', axle: 'Spare' },
      { position: 'SP2', label: 'SP2 - Spare 2', axle: 'Spare' },
    ],
  },
  light_motor_4: {
    label: "Light Motor Vehicle (4 wheels + spare)",
    fleetType: 'van',
    positions: [
      { position: 'V1', label: 'V1 - Front Left', axle: 'Front' },
      { position: 'V2', label: 'V2 - Front Right', axle: 'Front' },
      { position: 'V3', label: 'V3 - Rear Left', axle: 'Rear' },
      { position: 'V4', label: 'V4 - Rear Right', axle: 'Rear' },
      { position: 'SP', label: 'SP - Spare', axle: 'Spare' },
    ],
  },
};

// Map vehicle types to default templates
const VEHICLE_TYPE_DEFAULT_TEMPLATES: Record<string, string> = {
  horse_truck: 'horse_10',
  rigid_truck: 'horse_6',
  refrigerated_truck: 'horse_10',
  reefer: 'reefer_8',
  interlink: 'interlink_18',
  van: 'light_motor_4', // Map 'van' to the 4-wheel template
};

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const AddVehicleDialog = ({ open, onOpenChange }: AddVehicleDialogProps) => {
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

  const [createTyrePositions, setCreateTyrePositions] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);

  // Extract fleet number and check for existing config
  const fleetNumber = formData.fleet_number?.trim() || null;
  const existingFleetConfig = fleetNumber ? getFleetConfig(fleetNumber) : null;

  // Get the active template based on selection
  const activeTemplate = selectedTemplate ? TYRE_TEMPLATES[selectedTemplate] : null;

  // Determine effective configuration (existing fleet config or selected template)
  const effectivePositions = existingFleetConfig
    ? existingFleetConfig.positions
    : activeTemplate?.positions || [];

  const effectiveFleetType = existingFleetConfig
    ? existingFleetConfig.fleetType
    : activeTemplate?.fleetType || null;

  // Auto-select template based on vehicle type - called from onValueChange handler
  const handleVehicleTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, vehicle_type: value }));
    // Auto-select template only if no existing fleet config
    if (!existingFleetConfig) {
      const defaultTemplate = VEHICLE_TYPE_DEFAULT_TEMPLATES[value];
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    }
  };

  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData & { createTyrePositions: boolean; template: string; pendingDocs: PendingDocument[] }) => {
      // Create the vehicle first
      const { data: vehicle, error } = await supabase
        .from("vehicles")
        .insert([
          {
            fleet_number: data.fleet_number || null,
            registration_number: data.registration_number,
            make: data.make,
            model: data.model,
            vehicle_type: data.vehicle_type as Database["public"]["Enums"]["vehicle_type"],
            tonnage: data.tonnage ? parseFloat(data.tonnage) : null,
            engine_specs: data.vin_number || null,
            active: data.active,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Create tyre position entries if enabled
      if (data.createTyrePositions && data.registration_number) {
        const fleetNum = data.fleet_number?.trim() || null;
        const existingConfig = fleetNum ? getFleetConfig(fleetNum) : null;
        const template = data.template ? TYRE_TEMPLATES[data.template] : null;

        let positions: FleetTyrePosition[] = [];

        if (existingConfig) {
          // Use existing fleet configuration
          positions = existingConfig.positions;
        } else if (template) {
          // Use template configuration
          positions = template.positions;
        }

        if (fleetNum && positions.length > 0) {
          // Create position entries in unified fleet_tyre_positions table
          const positionEntries = positions.map(pos => ({
            fleet_number: fleetNum,
            vehicle_id: vehicle.id,
            registration_no: data.registration_number,
            position: pos.position,
            tyre_code: null, // Empty - no tyre installed yet
            updated_at: new Date().toISOString(),
          }));

          const { error: positionsError } = await supabase
            .from("fleet_tyre_positions")
            .insert(positionEntries);

          if (positionsError) {
            console.error("Failed to create tyre positions:", positionsError);
            console.warn(`Vehicle created but tyre positions could not be initialized: ${positionsError.message}`);
          } else {
            console.log(`✓ Created ${positionEntries.length} tyre positions for ${data.registration_number} in fleet_tyre_positions`);
          }
        } else {
          console.warn("No fleet number or positions found for tyre position initialization.");
        }
      }

      // Upload pending documents
      if (data.pendingDocs.length > 0) {
        for (const doc of data.pendingDocs) {
          try {
            let publicUrl = "";
            let fileName = "No file";
            let fileFormat = "none";

            if (doc.file) {
              const ext = doc.file.name.split(".").pop() || "dat";
              const path = `vehicle-documents/${vehicle.id}-${Date.now()}.${ext}`;
              const { error: uploadError } = await supabase.storage
                .from("documents")
                .upload(path, doc.file);
              if (uploadError) throw uploadError;

              const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
              publicUrl = urlData?.publicUrl as string;
              fileName = doc.file.name;
              fileFormat = ext;
            }

            const docNumber = doc.number || doc.type.toUpperCase();
            const { error: docError } = await supabase.from("work_documents").insert({
              vehicle_id: vehicle.id,
              document_type: "other" as const,
              document_category: doc.type,
              document_number: docNumber,
              title: `${doc.type.toUpperCase()} ${docNumber}`,
              file_name: fileName,
              file_format: fileFormat,
              file_url: publicUrl,
              uploaded_by: "system",
              metadata: doc.expiry
                ? { expiry_date: doc.expiry.toISOString().split("T")[0] }
                : null,
            });
            if (docError) {
              console.error("Failed to save document:", docError);
            }
          } catch (err) {
            console.error("Failed to upload document:", err);
          }
        }
      }

      return vehicle;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });

      const positionCount = effectivePositions.length;
      const docCount = variables.pendingDocs.length;
      let message = "Vehicle created successfully";
      if (variables.createTyrePositions && positionCount > 0 && docCount > 0) {
        message = `Vehicle created with ${positionCount} tyre positions and ${docCount} document(s)`;
      } else if (variables.createTyrePositions && positionCount > 0) {
        message = `Vehicle created with ${positionCount} tyre positions initialized`;
      } else if (docCount > 0) {
        message = `Vehicle created with ${docCount} document(s)`;
      }

      toast({
        title: "Success",
        description: message,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      fleet_number: "",
      registration_number: "",
      make: "",
      model: "",
      vehicle_type: "",
      tonnage: "",
      vin_number: "",
      active: true,
    });
    setSelectedTemplate("");
    setCreateTyrePositions(true);
    setPendingDocs([]);
  };

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

    createVehicleMutation.mutate({
      ...formData,
      createTyrePositions,
      template: selectedTemplate,
      pendingDocs,
    });
  };

  // Check if tyre configuration can be created
  const canCreateTyreConfig = (formData.fleet_number && (existingFleetConfig || activeTemplate)) ||
    (activeTemplate && effectiveFleetType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Create a new vehicle in the fleet management system
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
                onChange={(e) => {
                  setFormData({ ...formData, fleet_number: e.target.value });
                  // Reset template when fleet number changes if it has existing config
                  const newFleetNum = e.target.value.trim();
                  if (getFleetConfig(newFleetNum)) {
                    setSelectedTemplate("");
                  }
                }}
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
                onValueChange={handleVehicleTypeChange}
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
            <VehicleDocumentsSection
              pendingDocuments={pendingDocs}
              onPendingDocumentsChange={setPendingDocs}
            />

            {/* Tyre Position Configuration Section */}
            <div className="grid grid-cols-4 items-start gap-4 pt-4 border-t">
              <Label className="text-right pt-1">
                Tyre Config
              </Label>
              <div className="col-span-3 space-y-3">
                {/* Enable/Disable checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createTyrePositions"
                    checked={createTyrePositions}
                    onCheckedChange={(checked) => setCreateTyrePositions(checked === true)}
                  />
                  <Label htmlFor="createTyrePositions" className="text-sm font-normal cursor-pointer">
                    Initialize tyre positions for this vehicle
                  </Label>
                </div>

                {createTyrePositions && !existingFleetConfig && (
                  <div className="space-y-2">
                    <Label className="text-sm">Tyre Layout Template</Label>
                    <Select
                      value={selectedTemplate}
                      onValueChange={setSelectedTemplate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tyre layout" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {Object.entries(TYRE_TEMPLATES).map(([key, template]) => (
                          <SelectItem key={key} value={key}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Configuration Summary */}
                {createTyrePositions && canCreateTyreConfig && effectivePositions.length > 0 && (
                  <div className="p-3 bg-muted rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {existingFleetConfig ? (
                          <>Fleet <strong>{fleetNumber}</strong> Configuration</>
                        ) : (
                          <>Template: <strong>{activeTemplate?.label}</strong></>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {effectiveFleetType}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {effectivePositions.length} positions: {effectivePositions.map(p => p.position).join(', ')}
                    </p>
                    {formData.fleet_number && (
                      <p className="text-xs text-green-600">
                        ✓ Will create entries in: fleet_tyre_positions
                      </p>
                    )}
                  </div>
                )}

                {/* Warning if no configuration available */}
                {createTyrePositions && !canCreateTyreConfig && formData.vehicle_type && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Please select a tyre layout template to create position entries
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createVehicleMutation.isPending}>
              {createVehicleMutation.isPending ? "Creating..." : "Create Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddVehicleDialog;