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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AlertTriangle, ArrowRight, CheckCircle2, Package, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type TyreWithVehicle = Database["public"]["Tables"]["tyres"]["Row"] & {
  vehicles?: {
    id: string;
    registration_number: string;
    fleet_number: string;
    current_odometer: number | null;
  } | null;
};

interface RemoveTyreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tyre: TyreWithVehicle | null;
  onRemovalComplete: () => void;
}

const RemoveTyreDialog = ({ open, onOpenChange, tyre, onRemovalComplete }: RemoveTyreDialogProps) => {
  const { toast } = useToast();
  const { userName, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [formData, setFormData] = useState({
    removalReading: "",
    removalDate: new Date().toISOString().slice(0, 16),
    removalReason: "",
    postRemovalStatus: "",
    nextDestination: "",
    notes: "",
    returnToInventory: "yes",
    disposalReason: "",
  });

  const [calculatedMetrics, setCalculatedMetrics] = useState({
    totalKmRun: 0,
    wearPercentage: 0,
    exceedsLimit: false,
    daysInstalled: 0,
  });

  useEffect(() => {
    if (tyre && open) {
      // Pre-fill current vehicle odometer if available
      const currentReading = tyre.vehicles?.current_odometer || 0;

      // Calculate metrics
      const totalKm = currentReading - (tyre.installation_km || 0);
      const daysInstalled = tyre.installation_date
        ? Math.floor((new Date().getTime() - new Date(tyre.installation_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Assume max run is 120,000 km (configurable)
      const maxRunKm = 120000;
      const wearPercentage = (totalKm / maxRunKm) * 100;
      const exceedsLimit = wearPercentage > 100;

      setCalculatedMetrics({
        totalKmRun: totalKm,
        wearPercentage: Math.min(wearPercentage, 120),
        exceedsLimit,
        daysInstalled,
      });

      setFormData(prev => ({
        ...prev,
        removalReading: currentReading.toString(),
        removalDate: new Date().toISOString().slice(0, 16),
      }));
    }
  }, [tyre, open]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Recalculate metrics when removal reading changes
    if (field === "removalReading" && tyre) {
      const newReading = parseFloat(value) || 0;
      const totalKm = newReading - (tyre.installation_km || 0);
      const maxRunKm = 120000;
      const wearPercentage = (totalKm / maxRunKm) * 100;

      setCalculatedMetrics(prev => ({
        ...prev,
        totalKmRun: totalKm,
        wearPercentage: Math.min(wearPercentage, 120),
        exceedsLimit: wearPercentage > 100,
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!tyre) return false;

    if (!formData.removalReading || parseFloat(formData.removalReading) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid meter reading",
        variant: "destructive",
      });
      return false;
    }

    if (parseFloat(formData.removalReading) < (tyre.installation_km || 0)) {
      toast({
        title: "Validation Error",
        description: "Removal reading cannot be less than installation reading",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.removalReason) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for removal",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.postRemovalStatus) {
      toast({
        title: "Validation Error",
        description: "Please select post-removal status",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.nextDestination) {
      toast({
        title: "Validation Error",
        description: "Please select next destination",
        variant: "destructive",
      });
      return false;
    }

    if (formData.nextDestination === "scrap-dispose" && !formData.disposalReason) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for disposal",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleRemoval = async () => {
    if (!validateForm() || !tyre) return;

    setLoading(true);

    try {
      const removalReading = parseFloat(formData.removalReading);
      const kmTravelled = removalReading - (tyre.installation_km || 0);

      // 1. Update tyre record - clear vehicle assignment
      const { error: tyreUpdateError } = await supabase
        .from("tyres")
        .update({
          current_fleet_position: null,
          position: null,
          condition: formData.postRemovalStatus as Database["public"]["Enums"]["tyre_condition"],
          km_travelled: (tyre.km_travelled || 0) + kmTravelled,
          installation_km: null, // Clear since no longer on a vehicle
          notes: formData.notes || tyre.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tyre.id);

      if (tyreUpdateError) throw tyreUpdateError;

      // 2. Update unified fleet_tyre_positions table (clear tyre_code)
      if (tyre?.current_fleet_position && tyre?.vehicles) {
        // Parse format: "1T ADZ9011/ADZ9010-T1" or "33H JFK963FS-V3"
        // Handle registration numbers with slashes (truck/trailer combinations)
        const positionMatch = tyre.current_fleet_position?.match(/^(\d+[A-Z]+)\s+([A-Z0-9/\s]+)-([A-Z0-9]+)$/);
        if (positionMatch) {
          const [, fleetNumber, , position] = positionMatch;
          const fleetConfig = getFleetConfig(fleetNumber);

          if (fleetConfig) {
            const registrationNo = extractRegistrationNumber(tyre.vehicles.registration_number);

            // Update unified fleet_tyre_positions table
            const { error: fleetUpdateError } = await supabase
              .from("fleet_tyre_positions")
              .update({
                tyre_code: null,
                updated_at: new Date().toISOString(),
              })
              .eq("fleet_number", fleetNumber)
              .eq("registration_no", registrationNo)
              .eq("position", position);

            if (fleetUpdateError) {
              console.error("Failed to update fleet_tyre_positions:", fleetUpdateError);
            }
          }
        }
      }

      // 3. Create tyre position history record
      const { error: historyError } = await supabase
        .from("tyre_position_history")
        .insert({
          tyre_id: tyre.id,
          vehicle_id: tyre.vehicles?.id || null,
          action: "removed",
          fleet_position: tyre.current_fleet_position || "",
          from_position: tyre.current_fleet_position || "",
          to_position: formData.nextDestination === "return-warehouse" ? "WAREHOUSE" : "SCRAP",
          km_reading: removalReading,
          performed_at: formData.removalDate,
          performed_by: userName || user?.email || "unknown",
          notes: `Reason: ${formData.removalReason}. ${formData.notes || ""}`,
        });

      if (historyError) throw historyError;

      // 4. Create lifecycle event
      await supabase
        .from("tyre_lifecycle_events")
        .insert({
          tyre_id: tyre.id,
          tyre_code: tyre.serial_number || tyre.id,
          vehicle_id: tyre.vehicles?.id || null,
          event_type: "removal",
          event_date: formData.removalDate,
          fleet_position: tyre.current_fleet_position || null,
          km_reading: removalReading,
          tread_depth_at_event: tyre.current_tread_depth,
          notes: `Removed from ${tyre.current_fleet_position}. Reason: ${formData.removalReason}. Next: ${formData.nextDestination}`,
          performed_by: "current_user",
        });

      // 5. Update inventory if returning to warehouse
      if (formData.returnToInventory === "yes" && formData.nextDestination === "return-warehouse" && tyre.inventory_id) {
        try {
          // Call the increment_inventory RPC function
          // Note: Type cast needed until database types are regenerated after migration
          type InventoryResult = {
            success: boolean;
            quantity_before: number;
            quantity_after: number;
            error?: string;
          };

          const result = await supabase.rpc(
            "increment_inventory",
            {
              p_inventory_id: tyre.inventory_id,
              p_quantity: 1,
              p_reason: `Tyre ${tyre.serial_number || tyre.id} returned from vehicle ${tyre.vehicles?.registration_number || 'unknown'}`,
              p_reference_type: 'tyre_removal',
              p_reference_id: tyre.id,
            }
          );

          const inventoryResult = result.data as InventoryResult | null;
          const inventoryError = result.error as { message: string } | null;

          if (inventoryError) {
            console.error("⚠️ Inventory update failed:", inventoryError);
            toast({
              title: "Warning",
              description: "Tyre removed but inventory update failed. Please update manually.",
              variant: "destructive",
            });
          } else if (inventoryResult?.success) {
            console.log("✅ Inventory updated:", inventoryResult);
            toast({
              title: "Inventory Updated",
              description: `Quantity increased from ${inventoryResult.quantity_before} to ${inventoryResult.quantity_after}`,
            });
          }
        } catch (invErr) {
          console.error("⚠️ Inventory update exception:", invErr);
        }
      }

      toast({
        title: "Tyre Removed Successfully",
        description: `${tyre.serial_number || tyre.id} has been removed and ${formData.nextDestination === "return-warehouse" ? "returned to warehouse" : "marked for disposal"}`,
      });

      onRemovalComplete();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Removal error:", error);
      toast({
        title: "Removal Failed",
        description: error instanceof Error ? error.message : "Failed to remove tyre. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      removalReading: "",
      removalDate: new Date().toISOString().slice(0, 16),
      removalReason: "",
      postRemovalStatus: "",
      nextDestination: "",
      notes: "",
      returnToInventory: "yes",
      disposalReason: "",
    });
    setShowConfirmation(false);
  };

  if (!tyre) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tyre Removal Process
          </DialogTitle>
          <DialogDescription>
            Remove tyre from vehicle and update system records
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6 py-4">
            {/* Current Tyre Information */}
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tyre Number</Label>
                    <p className="font-mono font-bold text-lg">{tyre.serial_number || tyre.id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Brand/Model</Label>
                    <p className="font-medium">{tyre.brand} {tyre.model}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vehicle</Label>
                    <p className="font-medium">{tyre.vehicles?.registration_number || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Position</Label>
                    <Badge variant="outline">{tyre.current_fleet_position || "N/A"}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Installation KM</Label>
                    <p className="font-medium">{tyre.installation_km?.toLocaleString() || "N/A"} km</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Installation Date</Label>
                    <p className="font-medium">{tyre.installation_date ? new Date(tyre.installation_date).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculated Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-muted-foreground">Total KM Run</Label>
                  <p className="text-2xl font-bold">{calculatedMetrics.totalKmRun.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">km</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-muted-foreground">Wear Percentage</Label>
                  <p className={`text-2xl font-bold ${calculatedMetrics.exceedsLimit ? "text-destructive" : ""}`}>
                    {calculatedMetrics.wearPercentage.toFixed(1)}%
                  </p>
                  {calculatedMetrics.exceedsLimit && (
                    <Badge variant="destructive" className="text-xs">Exceeds Limit</Badge>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Label className="text-xs text-muted-foreground">Days Installed</Label>
                  <p className="text-2xl font-bold">{calculatedMetrics.daysInstalled}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </CardContent>
              </Card>
            </div>

            {calculatedMetrics.exceedsLimit && (
              <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Wear Limit Exceeded</p>
                  <p className="text-sm text-muted-foreground">
                    This tyre has exceeded the recommended 120% wear limit. Immediate removal is recommended.
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Removal Details Form */}
            <div className="space-y-4">
              <h3 className="font-semibold">Removal Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="removalReading">Meter Reading at Removal *</Label>
                  <Input
                    id="removalReading"
                    type="number"
                    value={formData.removalReading}
                    onChange={(e) => handleInputChange("removalReading", e.target.value)}
                    placeholder="Enter current odometer reading"
                  />
                  <p className="text-xs text-muted-foreground">Current vehicle odometer reading</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="removalDate">Removal Date/Time *</Label>
                  <Input
                    id="removalDate"
                    type="datetime-local"
                    value={formData.removalDate}
                    onChange={(e) => handleInputChange("removalDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="removalReason">Reason for Removal *</Label>
                <Select value={formData.removalReason} onValueChange={(value) => handleInputChange("removalReason", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select removal reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worn-out">Worn Out - Exceeded Run Limit</SelectItem>
                    <SelectItem value="fault-puncture">Fault - Puncture</SelectItem>
                    <SelectItem value="fault-sidewall">Fault - Sidewall Damage</SelectItem>
                    <SelectItem value="fault-tread-separation">Fault - Tread Separation</SelectItem>
                    <SelectItem value="rotation">Routine Rotation</SelectItem>
                    <SelectItem value="end-of-life">End of Life - Age</SelectItem>
                    <SelectItem value="vehicle-decommission">Vehicle Decommissioned</SelectItem>
                    <SelectItem value="maintenance">Scheduled Maintenance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postRemovalStatus">Post-Removal Status *</Label>
                  <Select value={formData.postRemovalStatus} onValueChange={(value) => handleInputChange("postRemovalStatus", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tyre condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New - Unused</SelectItem>
                      <SelectItem value="good">Good - Reusable</SelectItem>
                      <SelectItem value="fair">Fair - Limited Life</SelectItem>
                      <SelectItem value="worn">Worn - Near End of Life</SelectItem>
                      <SelectItem value="damaged">Damaged - Requires Repair</SelectItem>
                      <SelectItem value="scrap">Scrap - Not Reusable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextDestination">Next Destination *</Label>
                  <Select value={formData.nextDestination} onValueChange={(value) => handleInputChange("nextDestination", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return-warehouse">Return to Warehouse</SelectItem>
                      <SelectItem value="holding-bay">Holding Bay - Inspection</SelectItem>
                      <SelectItem value="retread-bay">Retread Bay - Refurbishment</SelectItem>
                      <SelectItem value="repair-shop">Repair Shop</SelectItem>
                      <SelectItem value="scrap-dispose">Scrap/Dispose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.nextDestination === "scrap-dispose" && (
                <div className="space-y-2">
                  <Label htmlFor="disposalReason">Disposal Reason *</Label>
                  <Textarea
                    id="disposalReason"
                    value={formData.disposalReason}
                    onChange={(e) => handleInputChange("disposalReason", e.target.value)}
                    placeholder="Explain why this tyre must be disposed of..."
                    rows={2}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Enter any additional comments or observations..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        ) : (
          // Confirmation Summary
          <div className="space-y-6 py-4">
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Confirm Tyre Removal</h3>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                  Please review the following changes before proceeding:
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">Current Status</p>
                      <p className="text-sm text-muted-foreground">Mounted on {tyre.current_fleet_position}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">New Status</p>
                      <p className="text-sm text-muted-foreground capitalize">{formData.postRemovalStatus} - {formData.nextDestination.replace(/-/g, " ")}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Total KM Run</Label>
                      <p className="font-medium">{calculatedMetrics.totalKmRun.toLocaleString()} km</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Wear Percentage</Label>
                      <p className="font-medium">{calculatedMetrics.wearPercentage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Removal Reason</Label>
                      <p className="font-medium capitalize">{formData.removalReason.replace(/-/g, " ")}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Next Action</Label>
                      <p className="font-medium capitalize">{formData.nextDestination.replace(/-/g, " ")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {formData.nextDestination === "scrap-dispose" && (
              <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-100">Disposal Action</p>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    This tyre will be marked for disposal and removed from active inventory. This action cannot be easily reversed.
                  </p>
                </div>
              </div>
            )}
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
              Review Removal
            </Button>
          ) : (
            <Button
              onClick={handleRemoval}
              disabled={loading}
              variant="destructive"
            >
              {loading ? "Removing..." : "Confirm & Remove Tyre"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveTyreDialog;