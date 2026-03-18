import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { extractRegistrationNumber, getFleetConfig } from "@/constants/fleetTyreConfig";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
type TyreInventory = Database["public"]["Tables"]["tyre_inventory"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

interface InstallTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstallationComplete: () => void;
  preSelectedVehicle?: Vehicle | null;
  preSelectedPosition?: string | null;
  preSelectedInventoryItem?: TyreInventory | null;
}

const InstallTyreDialog = ({
  open,
  onOpenChange,
  onInstallationComplete,
  preSelectedVehicle = null,
  preSelectedPosition = null,
  preSelectedInventoryItem = null,
}: InstallTyreDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedTyre, setSelectedTyre] = useState<TyreInventory | null>(null);

  const [formData, setFormData] = useState({
    vehicleId: preSelectedVehicle?.id || "",
    position: preSelectedPosition || "",
    tyreId: preSelectedInventoryItem?.id || "",
    installationReading: "",
    installationDate: new Date().toISOString().slice(0, 16),
    installerName: "",
    notes: "",
  });

  const [availablePositions, setAvailablePositions] = useState<string[]>([]);

  // Set the selected tyre if preselected
  useEffect(() => {
    if (preSelectedInventoryItem && open) {
      setSelectedTyre(preSelectedInventoryItem);
      setFormData(prev => ({ ...prev, tyreId: preSelectedInventoryItem.id }));
    }
  }, [preSelectedInventoryItem, open]);

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_for_installation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("registration_number");

      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: open,
  });

  // Fetch available tyres from inventory (in stock)
  const { data: availableTyres = [] } = useQuery({
    queryKey: ["available_tyres_for_installation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyre_inventory")
        .select("*")
        .gt("quantity", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch occupied positions for selected vehicle
  useEffect(() => {
    const fetchOccupiedPositions = async () => {
      if (!formData.vehicleId) {
        setAvailablePositions([]);
        return;
      }

      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (!vehicle) return;

      // Use fleet_number from the vehicles table directly
      const fleetNumber = vehicle.fleet_number;
      if (!fleetNumber) {
        console.warn(`Vehicle ${vehicle.registration_number} does not have a fleet_number set`);
        return;
      }

      const fleetConfig = getFleetConfig(fleetNumber);
      if (!fleetConfig) return;

      try {
        const registrationNo = extractRegistrationNumber(vehicle.registration_number);
        console.log(`🔍 DEBUG: Full registration: "${vehicle.registration_number}"`);
        console.log(`🔍 DEBUG: Extracted registration: "${registrationNo}"`);
        console.log(`🔍 DEBUG: Fleet number: ${fleetNumber}`);
        console.log(`🔍 DEBUG: Fleet config:`, fleetConfig);

        // Step 1: Get all available positions from static config
        const allAvailablePositions = fleetConfig.positions.map(pos => pos.position);
        console.log(`✓ Available positions from config for ${fleetNumber}:`, allAvailablePositions);

        // Step 2: Query unified fleet_tyre_positions table to find occupied positions
        console.log(`🔍 Querying fleet_tyre_positions for fleet_number="${fleetNumber}" and registration_no="${registrationNo}"`);

        const { data: fleetPositions, error } = await supabase
          .from("fleet_tyre_positions")
          .select("position, tyre_code")
          .eq("fleet_number", fleetNumber)
          .eq("registration_no", registrationNo);

        console.log(`📊 Query result:`, {
          rowsReturned: fleetPositions?.length || 0,
          error: error?.message || null
        });

        if (error) {
          console.error(`❌ Error querying fleet_tyre_positions:`, error);
          // If query fails, assume all positions are available
          console.log(`ℹ️ Using all static positions as available (query error)`);
          setAvailablePositions(allAvailablePositions);
          return;
        }

        console.log(`📊 Raw fleet positions data for ${registrationNo}:`, fleetPositions);

        // Filter out occupied positions - a position is occupied if it has a non-empty tyre_code
        // Ignore placeholder codes like 'NEW_CODE_21H', 'NEW_CODE_14L', etc.
        // These are default values that indicate the position is actually empty
        const occupiedPositions = (fleetPositions || [])
          .filter((fp) => {
            if (!fp.tyre_code || fp.tyre_code.trim() === '') return false;
            // Ignore placeholder codes that start with 'NEW_CODE_'
            if (fp.tyre_code.startsWith('NEW_CODE_')) return false;
            return true;
          })
          .map((fp) => fp.position);

        console.log(`✓ Occupied positions for ${registrationNo}: ${occupiedPositions.length} positions -`, occupiedPositions);

        // Filter out occupied ones
        const availablePos = allAvailablePositions.filter(
          pos => !occupiedPositions.includes(pos)
        );

        console.log(`✓ Available positions: ${availablePos.length}/${allAvailablePositions.length}`, availablePos.length > 0 ? availablePos : '(No positions available)');

        // Debug: Show which positions are which
        if (availablePos.length === 0 && allAvailablePositions.length > 0) {
          console.warn(`⚠️ All ${allAvailablePositions.length} positions are occupied for ${registrationNo}`);
          console.log(`   Details of occupied positions:`);
          (fleetPositions || []).forEach(fp => {
            console.log(`   - ${fp.position}: tyre_code="${fp.tyre_code}"`);
          });
        }

        setAvailablePositions(availablePos);
      } catch (error) {
        console.error("Error fetching positions:", error);
      }
    };

    if (open && formData.vehicleId) {
      fetchOccupiedPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.vehicleId, open]); // Run when vehicleId changes or dialog opens

  // Update selected tyre when tyreId changes
  useEffect(() => {
    if (formData.tyreId) {
      const tyre = availableTyres.find(t => t.id === formData.tyreId);
      setSelectedTyre(tyre || null);
    } else {
      setSelectedTyre(null);
    }
  }, [formData.tyreId, availableTyres]);

  // Pre-fill vehicle and position if provided
  useEffect(() => {
    if (open && preSelectedVehicle) {
      setFormData(prev => ({
        ...prev,
        vehicleId: preSelectedVehicle.id,
        position: preSelectedPosition || "",
      }));
    }
  }, [open, preSelectedVehicle, preSelectedPosition]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Reset position when vehicle changes
    if (field === "vehicleId") {
      setFormData(prev => ({ ...prev, position: "" }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.vehicleId) {
      toast({
        title: "Validation Error",
        description: "Please select a vehicle",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.position) {
      toast({
        title: "Validation Error",
        description: "Please select a position",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.tyreId || !selectedTyre) {
      toast({
        title: "Validation Error",
        description: "Please select a tyre to install",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.installationReading || parseFloat(formData.installationReading) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid meter reading",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.installerName) {
      toast({
        title: "Validation Error",
        description: "Please enter installer name",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleInstallation = async () => {
    if (!validateForm() || !selectedTyre) return;

    setLoading(true);

    try {
      // ===== BACKEND VERIFICATION CHECKS =====

      // 1. Verify vehicle exists and has fleet number
      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (!vehicle) throw new Error("Vehicle not found");

      // Use fleet_number from the vehicles table directly
      const fleetNumber = vehicle.fleet_number;
      if (!fleetNumber) throw new Error(`Vehicle ${vehicle.registration_number} does not have a fleet_number set`);

      console.log("✓ Vehicle verified:", vehicle.registration_number, "Fleet:", fleetNumber);

      // 2. Verify fleet configuration exists
      const fleetConfig = getFleetConfig(fleetNumber);
      if (!fleetConfig) throw new Error(`Fleet configuration not found for fleet number: ${fleetNumber}`);

      console.log("✓ Fleet config verified:", fleetConfig.fleetType, "Positions:", fleetConfig.positions.length);

      // 3. Verify position exists in fleet configuration
      const positionExists = fleetConfig.positions.some(p => p.position === formData.position);
      if (!positionExists) {
        throw new Error(`Position ${formData.position} does not exist in fleet configuration for ${fleetNumber}`);
      }

      console.log("✓ Position verified:", formData.position);

      // 4. Verify inventory item is still available
      const { data: currentInventoryData, error: inventoryCheckError } = await supabase
        .from("tyre_inventory")
        .select("id, quantity, brand, model")
        .eq("id", selectedTyre.id)
        .single();

      if (inventoryCheckError) throw new Error(`Failed to verify inventory availability: ${inventoryCheckError.message}`);

      if (currentInventoryData.quantity < 1) {
        throw new Error(`Inventory item ${currentInventoryData.brand} ${currentInventoryData.model} is out of stock. Please refresh and try again.`);
      }

      console.log("✓ Inventory availability verified:", currentInventoryData.quantity, "unit(s) available");

      // 5. Verify position is not already occupied
      const registrationNo = extractRegistrationNumber(vehicle.registration_number);
      console.log("Registration extracted:", registrationNo, "from", vehicle.registration_number);

      // Query unified fleet_tyre_positions table
      const { data: existingPosition, error: positionCheckError } = await supabase
        .from("fleet_tyre_positions")
        .select("position, tyre_code")
        .eq("fleet_number", fleetNumber)
        .eq("registration_no", registrationNo)
        .eq("position", formData.position)
        .maybeSingle();

      if (positionCheckError) throw new Error(`Failed to check position availability: ${positionCheckError.message}`);

      // Check if position is occupied - ignore placeholder codes that start with 'NEW_CODE_'
      // These placeholder codes indicate empty positions that were initialized with default values
      const isPositionOccupied = existingPosition &&
        existingPosition.tyre_code &&
        existingPosition.tyre_code.trim() !== '' &&
        !existingPosition.tyre_code.startsWith('NEW_CODE_');

      if (isPositionOccupied) {
        throw new Error(`Position ${formData.position} is already occupied by tyre ${existingPosition.tyre_code}. Please refresh and select another position.`);
      }

      console.log("✓ Position availability verified:", formData.position, "is empty (tyre_code:", existingPosition?.tyre_code || 'null', ")");

      // 6. Verify installation reading is valid
      const installationReading = parseFloat(formData.installationReading);
      if (isNaN(installationReading) || installationReading < 0) {
        throw new Error("Invalid installation reading");
      }

      console.log("✓ Installation reading verified:", installationReading);

      // ===== ALL CHECKS PASSED - PROCEED WITH INSTALLATION =====

      const fleetPosition = `${fleetNumber} ${vehicle.registration_number}-${formData.position}`;
      console.log("Fleet position to be set:", fleetPosition);

      // 1. Create new tyre record from inventory item
      const { data: newTyre, error: tyreCreateError } = await supabase
        .from("tyres")
        .insert({
          brand: selectedTyre.brand,
          model: selectedTyre.model,
          size: selectedTyre.size,
          type: selectedTyre.type,
          initial_tread_depth: selectedTyre.initial_tread_depth || 10,
          current_tread_depth: selectedTyre.initial_tread_depth || 10,
          condition: "good" as const,
          current_fleet_position: fleetPosition,
          position: formData.position,
          installation_date: formData.installationDate,
          installation_km: installationReading,
          installer_name: formData.installerName,
          purchase_cost_zar: selectedTyre.purchase_cost_zar || 0,
          inventory_id: selectedTyre.id, // Link back to inventory item
          km_travelled: 0,
          notes: formData.notes || `Installed from inventory: ${selectedTyre.brand} ${selectedTyre.model}. DOT: ${selectedTyre.dot_code || 'N/A'}`,
        })
        .select()
        .single();
      if (tyreCreateError) {
        console.error("Tyre create error:", tyreCreateError);
        throw new Error(`Failed to create tyre record: ${tyreCreateError.message}`);
      }
      console.log("✓ Tyre record created:", newTyre.id);

      // 2. Decrement inventory quantity
      const { error: inventoryUpdateError } = await supabase
        .from("tyre_inventory")
        .update({
          quantity: currentInventoryData.quantity - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTyre.id);

      if (inventoryUpdateError) throw inventoryUpdateError;
      console.log("✓ Inventory decremented");

      // 3. Update or insert into unified fleet_tyre_positions table
      // First check if the position row exists for this vehicle
      const { data: existingRow } = await supabase
        .from("fleet_tyre_positions")
        .select("position")
        .eq("fleet_number", fleetNumber)
        .eq("registration_no", registrationNo)
        .eq("position", formData.position)
        .maybeSingle();

      if (existingRow) {
        // Update existing row
        const { error: fleetUpdateError } = await supabase
          .from("fleet_tyre_positions")
          .update({
            tyre_code: newTyre.id,
            updated_at: new Date().toISOString(),
          })
          .eq("fleet_number", fleetNumber)
          .eq("registration_no", registrationNo)
          .eq("position", formData.position);

        if (fleetUpdateError) {
          console.error("Fleet update error:", fleetUpdateError);
          throw new Error(`Failed to update fleet position: ${fleetUpdateError.message}`);
        }
        console.log("✓ Fleet position table updated (existing row)");
      } else {
        // Insert new row - position doesn't exist yet for this vehicle
        const { error: fleetInsertError } = await supabase
          .from("fleet_tyre_positions")
          .insert({
            fleet_number: fleetNumber,
            vehicle_id: vehicle.id,
            registration_no: registrationNo,
            position: formData.position,
            tyre_code: newTyre.id,
            updated_at: new Date().toISOString(),
          });

        if (fleetInsertError) {
          console.error("Fleet insert error:", fleetInsertError);
          throw new Error(`Failed to create fleet position: ${fleetInsertError.message}`);
        }
        console.log("✓ Fleet position table created (new row for", registrationNo, "at position", formData.position, ")");
      }

      // 4. Create tyre position history record
      const { error: historyError } = await supabase
        .from("tyre_position_history")
        .insert({
          tyre_id: newTyre.id,
          vehicle_id: vehicle.id,
          action: "installed",
          fleet_position: fleetPosition,
          from_position: "WAREHOUSE",
          to_position: fleetPosition,
          km_reading: installationReading,
          performed_at: formData.installationDate,
          performed_by: formData.installerName,
          notes: formData.notes || `Installed ${selectedTyre.brand} ${selectedTyre.model} to position ${formData.position}`,
        });

      if (historyError) throw historyError;
      console.log("✓ Position history created");

      // 5. Create lifecycle event
      await supabase
        .from("tyre_lifecycle_events")
        .insert({
          tyre_id: newTyre.id,
          tyre_code: newTyre.id,
          vehicle_id: vehicle.id,
          event_type: "installation",
          event_date: formData.installationDate,
          fleet_position: fleetPosition,
          km_reading: installationReading,
          tread_depth_at_event: selectedTyre.initial_tread_depth || 10,
          notes: `Installed from inventory to ${fleetPosition}. Installer: ${formData.installerName}`,
          performed_by: formData.installerName,
        });

      console.log("✓ Lifecycle event created");
      console.log("✓✓✓ Installation completed successfully ✓✓✓");

      toast({
        title: "Tyre Installed Successfully",
        description: `${selectedTyre.brand} ${selectedTyre.model} has been installed on ${vehicle.registration_number} at position ${formData.position}`,
      });
      requestGoogleSheetsSync('tyres');

      onInstallationComplete();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Installation error:", error);
      toast({
        title: "Installation Failed",
        description: error instanceof Error ? error.message : "Failed to install tyre. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleId: "",
      position: "",
      tyreId: "",
      installationReading: "",
      installationDate: new Date().toISOString().slice(0, 16),
      installerName: "",
      notes: "",
    });
    setSelectedTyre(null);
    setShowConfirmation(false);
  };

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
  const selectedFleetNumber = selectedVehicle?.fleet_number || null;
  const fleetConfig = selectedFleetNumber ? getFleetConfig(selectedFleetNumber) : null;
  const positionLabel = fleetConfig?.positions.find(p => p.position === formData.position)?.label;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Install Tyre to Vehicle
          </DialogTitle>
          <DialogDescription>
            Allocate a tyre from warehouse to a specific vehicle position
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6 py-4">
            {/* Vehicle Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Select Vehicle & Position</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Vehicle *</Label>
                  <Select value={formData.vehicleId} onValueChange={(value) => handleInputChange("vehicleId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(vehicle => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.fleet_number || "?"} - {vehicle.registration_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) => handleInputChange("position", value)}
                    disabled={!formData.vehicleId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePositions.length === 0 && formData.vehicleId && (
                        <div className="p-2 text-sm text-muted-foreground">
                          All positions are occupied
                        </div>
                      )}
                      {fleetConfig?.positions
                        .filter(pos => availablePositions.includes(pos.position))
                        .map(pos => (
                          <SelectItem key={pos.position} value={pos.position}>
                            {pos.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {availablePositions.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {availablePositions.length} position(s) available
                    </p>
                  )}
                </div>
              </div>

              {selectedVehicle && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Fleet Number</Label>
                        <p className="font-medium">{selectedFleetNumber || "Not Found"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
                        <Badge variant="outline" className="capitalize">{selectedVehicle.vehicle_type.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Tyre Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Select Tyre from Warehouse</h3>
                <Badge variant="secondary">{availableTyres.length} available</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tyre">Available Tyres *</Label>
                <Select value={formData.tyreId} onValueChange={(value) => handleInputChange("tyreId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tyre to install" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTyres.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No tyres available in warehouse
                      </div>
                    ) : (
                      availableTyres.map(tyre => (
                        <SelectItem key={tyre.id} value={tyre.id}>
                          {tyre.brand} {tyre.model} ({tyre.size}) - {tyre.type}
                          {tyre.location && ` - ${tyre.location}`}
                          {` - Qty: ${tyre.quantity}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedTyre && (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Inventory Item</Label>
                        <p className="font-mono font-bold">{selectedTyre.id}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Brand/Model</Label>
                        <p className="font-medium">{selectedTyre.brand} {selectedTyre.model}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Size/Type</Label>
                        <p className="font-medium">{selectedTyre.size} - {selectedTyre.type}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Stock Status</Label>
                        <Badge variant={selectedTyre.status === "in_stock" ? "default" : "secondary"} className="capitalize">
                          {selectedTyre.status?.replace('_', ' ') || "Available"}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Initial Tread Depth</Label>
                        <p className="font-medium">
                          {selectedTyre.initial_tread_depth || "N/A"} mm
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Available Quantity</Label>
                        <p className="font-medium">{selectedTyre.quantity} unit(s)</p>
                      </div>
                      {selectedTyre.location && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Location</Label>
                          <p className="font-medium">{selectedTyre.location}</p>
                        </div>
                      )}
                      {selectedTyre.purchase_cost_zar && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                          <p className="font-medium">R {selectedTyre.purchase_cost_zar.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {selectedTyre.quantity < 5 && (
                      <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 rounded">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          Low stock: Only {selectedTyre.quantity} unit(s) remaining in inventory.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Installation Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Installation Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="installationReading">Meter Reading at Installation *</Label>
                  <Input
                    id="installationReading"
                    type="number"
                    value={formData.installationReading}
                    onChange={(e) => handleInputChange("installationReading", e.target.value)}
                    placeholder="Enter current odometer reading"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="installationDate">Installation Date/Time *</Label>
                  <Input
                    id="installationDate"
                    type="datetime-local"
                    value={formData.installationDate}
                    onChange={(e) => handleInputChange("installationDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="installerName">Installer Name *</Label>
                <Input
                  id="installerName"
                  value={formData.installerName}
                  onChange={(e) => handleInputChange("installerName", e.target.value)}
                  placeholder="Enter name of person performing installation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Installation Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Enter any observations, torque specifications, or special instructions..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        ) : (
          // Confirmation Summary
          <div className="space-y-6 py-4">
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900 dark:text-green-100">Confirm Tyre Installation</h3>
                </div>
                <p className="text-sm text-green-800 dark:text-green-200 mb-4">
                  Please review the following installation details before proceeding:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">From Warehouse</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTyre?.brand} {selectedTyre?.model} - {selectedTyre?.size}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">To Vehicle</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedVehicle?.registration_number} - Position {positionLabel}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Installation KM</Label>
                      <p className="font-medium">{parseFloat(formData.installationReading).toLocaleString()} km</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Installer</Label>
                      <p className="font-medium">{formData.installerName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Stock Status</Label>
                      <Badge className="capitalize">{selectedTyre?.status?.replace('_', ' ') || "Available"}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Initial Tread Depth</Label>
                      <p className="font-medium">
                        {selectedTyre?.initial_tread_depth || "N/A"} mm
                      </p>
                    </div>
                  </div>

                  {formData.notes && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="text-sm mt-1">{formData.notes}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (showConfirmation) {
                setShowConfirmation(false);
              } else {
                onOpenChange(false);
                resetForm();
              }
            }}
          >
            {showConfirmation ? "Back" : "Cancel"}
          </Button>
          {!showConfirmation ? (
            <Button
              onClick={() => {
                if (validateForm()) {
                  setShowConfirmation(true);
                }
              }}
              disabled={loading}
            >
              Review Installation
            </Button>
          ) : (
            <Button
              onClick={handleInstallation}
              disabled={loading}
            >
              {loading ? "Installing..." : "Confirm & Install Tyre"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstallTyreDialog;