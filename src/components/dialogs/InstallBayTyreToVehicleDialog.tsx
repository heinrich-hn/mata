import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowRight, CheckCircle2, Truck } from "lucide-react";
import { useEffect, useState } from "react";

type Tyre = Database["public"]["Tables"]["tyres"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

interface InstallBayTyreToVehicleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tyre: Tyre | null;
    onInstallationComplete: () => void;
}

const InstallBayTyreToVehicleDialog = ({
    open,
    onOpenChange,
    tyre,
    onInstallationComplete,
}: InstallBayTyreToVehicleDialogProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const [formData, setFormData] = useState({
        vehicleId: "",
        position: "",
        installationReading: "",
        installationDate: new Date().toISOString().slice(0, 16),
        installerName: "",
        notes: "",
    });

    const [availablePositions, setAvailablePositions] = useState<string[]>([]);

    // Fetch vehicles
    const { data: vehicles = [] } = useQuery({
        queryKey: ["vehicles_for_bay_install"],
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

    // Fetch occupied positions for selected vehicle
    useEffect(() => {
        const fetchOccupiedPositions = async () => {
            if (!formData.vehicleId) {
                setAvailablePositions([]);
                return;
            }

            const vehicle = vehicles.find(v => v.id === formData.vehicleId);
            if (!vehicle?.fleet_number) return;

            const fleetConfig = getFleetConfig(vehicle.fleet_number);
            if (!fleetConfig) return;

            try {
                const registrationNo = extractRegistrationNumber(vehicle.registration_number);
                const allPositions = fleetConfig.positions.map(pos => pos.position);

                const { data: fleetPositions, error } = await supabase
                    .from("fleet_tyre_positions")
                    .select("position, tyre_code")
                    .eq("fleet_number", vehicle.fleet_number)
                    .eq("registration_no", registrationNo);

                if (error) {
                    setAvailablePositions(allPositions);
                    return;
                }

                const occupiedPositions = (fleetPositions || [])
                    .filter(fp => fp.tyre_code && fp.tyre_code.trim() !== '' && !fp.tyre_code.startsWith('NEW_CODE_'))
                    .map(fp => fp.position);

                setAvailablePositions(allPositions.filter(pos => !occupiedPositions.includes(pos)));
            } catch {
                console.error("Error fetching positions");
            }
        };

        if (open && formData.vehicleId) {
            fetchOccupiedPositions();
        }
    }, [formData.vehicleId, open, vehicles]);

    // Pre-fill odometer when vehicle is selected
    useEffect(() => {
        if (formData.vehicleId) {
            const vehicle = vehicles.find(v => v.id === formData.vehicleId);
            if (vehicle?.current_odometer) {
                setFormData(prev => ({
                    ...prev,
                    installationReading: vehicle.current_odometer?.toString() || "",
                }));
            }
        }
    }, [formData.vehicleId, vehicles]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === "vehicleId") {
            setFormData(prev => ({ ...prev, position: "" }));
        }
    };

    const validateForm = (): boolean => {
        if (!formData.vehicleId) {
            toast({ title: "Validation Error", description: "Please select a vehicle", variant: "destructive" });
            return false;
        }
        if (!formData.position) {
            toast({ title: "Validation Error", description: "Please select a position", variant: "destructive" });
            return false;
        }
        if (!formData.installationReading || parseFloat(formData.installationReading) <= 0) {
            toast({ title: "Validation Error", description: "Please enter a valid odometer reading", variant: "destructive" });
            return false;
        }
        if (!formData.installerName) {
            toast({ title: "Validation Error", description: "Please enter installer name", variant: "destructive" });
            return false;
        }
        return true;
    };

    const handleInstallation = async () => {
        if (!validateForm() || !tyre) return;

        setLoading(true);

        try {
            const vehicle = vehicles.find(v => v.id === formData.vehicleId);
            if (!vehicle) throw new Error("Vehicle not found");

            const fleetNumber = vehicle.fleet_number;
            if (!fleetNumber) throw new Error(`Vehicle ${vehicle.registration_number} does not have a fleet_number set`);

            const fleetConfig = getFleetConfig(fleetNumber);
            if (!fleetConfig) throw new Error(`Fleet configuration not found for ${fleetNumber}`);

            const registrationNo = extractRegistrationNumber(vehicle.registration_number);
            const installationReading = parseFloat(formData.installationReading);
            const fleetPosition = `${fleetNumber} ${vehicle.registration_number}-${formData.position}`;

            // Verify position is not occupied
            const { data: existingPosition } = await supabase
                .from("fleet_tyre_positions")
                .select("position, tyre_code")
                .eq("fleet_number", fleetNumber)
                .eq("registration_no", registrationNo)
                .eq("position", formData.position)
                .maybeSingle();

            const isOccupied = existingPosition?.tyre_code &&
                existingPosition.tyre_code.trim() !== '' &&
                !existingPosition.tyre_code.startsWith('NEW_CODE_');

            if (isOccupied) {
                throw new Error(`Position ${formData.position} is already occupied`);
            }

            // 1. Update the existing tyre record - reassign to vehicle
            const { error: tyreUpdateError } = await supabase
                .from("tyres")
                .update({
                    current_fleet_position: fleetPosition,
                    position: formData.position,
                    installation_date: formData.installationDate,
                    installation_km: installationReading,
                    installer_name: formData.installerName,
                    notes: formData.notes || tyre.notes,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", tyre.id);

            if (tyreUpdateError) throw tyreUpdateError;

            // 2. Update fleet_tyre_positions table
            if (existingPosition) {
                const { error: fleetUpdateError } = await supabase
                    .from("fleet_tyre_positions")
                    .update({
                        tyre_code: tyre.id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("fleet_number", fleetNumber)
                    .eq("registration_no", registrationNo)
                    .eq("position", formData.position);

                if (fleetUpdateError) throw fleetUpdateError;
            } else {
                const { error: fleetInsertError } = await supabase
                    .from("fleet_tyre_positions")
                    .insert({
                        fleet_number: fleetNumber,
                        vehicle_id: vehicle.id,
                        registration_no: registrationNo,
                        position: formData.position,
                        tyre_code: tyre.id,
                        updated_at: new Date().toISOString(),
                    });

                if (fleetInsertError) throw fleetInsertError;
            }

            // 3. Create position history record
            const previousLocation = tyre.position || "UNKNOWN";
            await supabase.from("tyre_position_history").insert({
                tyre_id: tyre.id,
                vehicle_id: vehicle.id,
                action: "installed",
                fleet_position: fleetPosition,
                from_position: previousLocation,
                to_position: fleetPosition,
                km_reading: installationReading,
                performed_at: formData.installationDate,
                performed_by: formData.installerName,
                notes: `Reinstalled from ${previousLocation} to ${fleetPosition}. Lifetime KM: ${(tyre.km_travelled || 0).toLocaleString()}`,
            });

            // 4. Create lifecycle event
            await supabase.from("tyre_lifecycle_events").insert({
                tyre_id: tyre.id,
                tyre_code: tyre.serial_number || tyre.dot_code || tyre.id,
                vehicle_id: vehicle.id,
                event_type: "installation",
                event_date: formData.installationDate,
                fleet_position: fleetPosition,
                km_reading: installationReading,
                tread_depth_at_event: tyre.current_tread_depth,
                notes: `Reinstalled from ${previousLocation} to ${fleetPosition}. Installer: ${formData.installerName}`,
                performed_by: formData.installerName,
            });

            toast({
                title: "Tyre Installed Successfully",
                description: `${tyre.brand} ${tyre.model} has been installed on ${vehicle.registration_number} at position ${formData.position}`,
            });
            requestGoogleSheetsSync('tyres');

            onInstallationComplete();
            onOpenChange(false);
            resetForm();
        } catch (error) {
            console.error("Installation error:", error);
            toast({
                title: "Installation Failed",
                description: error instanceof Error ? error.message : "Failed to install tyre",
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
            installationReading: "",
            installationDate: new Date().toISOString().slice(0, 16),
            installerName: "",
            notes: "",
        });
        setShowConfirmation(false);
    };

    if (!tyre) return null;

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
                        <Truck className="h-5 w-5" />
                        Install Tyre to Vehicle
                    </DialogTitle>
                    <DialogDescription>
                        Move tyre from bay to a vehicle position
                    </DialogDescription>
                </DialogHeader>

                {/* Tyre Info Card */}
                <Card className="bg-muted/30">
                    <CardContent className="pt-4 pb-3">
                        <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs">Brand/Model</span>
                                <p className="font-semibold">{tyre.brand} {tyre.model}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Size</span>
                                <p className="font-semibold">{tyre.size}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Tread Depth</span>
                                <p className="font-semibold">{tyre.current_tread_depth ? `${tyre.current_tread_depth}mm` : '-'}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Lifetime KM</span>
                                <p className="font-semibold">{(tyre.km_travelled || 0).toLocaleString()}</p>
                            </div>
                        </div>
                        {tyre.serial_number && (
                            <Badge variant="outline" className="mt-2 text-xs">
                                S/N: {tyre.serial_number}
                            </Badge>
                        )}
                    </CardContent>
                </Card>

                {!showConfirmation ? (
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Vehicle *</Label>
                                <Select value={formData.vehicleId} onValueChange={(value) => handleInputChange("vehicleId", value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vehicle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.fleet_number || "?"} - {v.registration_number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Position *</Label>
                                <Select value={formData.position} onValueChange={(value) => handleInputChange("position", value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={availablePositions.length === 0 ? "Select vehicle first" : "Select position"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availablePositions.map(pos => {
                                            const label = fleetConfig?.positions.find(p => p.position === pos)?.label || pos;
                                            return (
                                                <SelectItem key={pos} value={pos}>
                                                    {pos} - {label}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Odometer Reading (km) *</Label>
                                <Input
                                    type="number"
                                    value={formData.installationReading}
                                    onChange={(e) => handleInputChange("installationReading", e.target.value)}
                                    placeholder="Current vehicle km"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Installation Date</Label>
                                <Input
                                    type="datetime-local"
                                    value={formData.installationDate}
                                    onChange={(e) => handleInputChange("installationDate", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Installer Name *</Label>
                            <Input
                                value={formData.installerName}
                                onChange={(e) => handleInputChange("installerName", e.target.value)}
                                placeholder="Name of person installing"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange("notes", e.target.value)}
                                placeholder="Additional notes"
                                rows={2}
                            />
                        </div>
                    </div>
                ) : (
                    <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-800 dark:text-green-200">Confirm Installation</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Tyre:</span>
                                    <span className="font-semibold">{tyre.brand} {tyre.model} ({tyre.size})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Vehicle:</span>
                                    <span className="font-semibold">{selectedVehicle?.fleet_number} - {selectedVehicle?.registration_number}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Position:</span>
                                    <span className="font-semibold">{formData.position} {positionLabel ? `(${positionLabel})` : ''}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Odometer:</span>
                                    <span className="font-semibold">{parseFloat(formData.installationReading).toLocaleString()} km</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground mt-2">
                                    <span>{tyre.position || "Bay"}</span>
                                    <ArrowRight className="h-4 w-4" />
                                    <span>{selectedVehicle?.registration_number} - {formData.position}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <DialogFooter>
                    {!showConfirmation ? (
                        <Button onClick={() => {
                            if (validateForm()) setShowConfirmation(true);
                        }}>
                            Review Installation
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                                Back
                            </Button>
                            <Button onClick={handleInstallation} disabled={loading}>
                                {loading ? "Installing..." : "Confirm Installation"}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InstallBayTyreToVehicleDialog;
