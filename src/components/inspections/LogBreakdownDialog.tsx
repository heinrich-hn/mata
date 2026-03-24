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
import { Textarea } from "@/components/ui/textarea";
import {
    useCreateFleetBreakdown,
    useUpdateFleetBreakdown,
    type FleetBreakdown,
} from "@/hooks/useFleetBreakdowns";
import { useVehicles } from "@/hooks/useVehicles";
import { useEffect, useState } from "react";

const SEVERITIES = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
];

const CATEGORIES = [
    { value: "mechanical", label: "Mechanical" },
    { value: "electrical", label: "Electrical" },
    { value: "tyre", label: "Tyre" },
    { value: "engine", label: "Engine" },
    { value: "transmission", label: "Transmission" },
    { value: "brakes", label: "Brakes" },
    { value: "cooling", label: "Cooling" },
    { value: "fuel_system", label: "Fuel System" },
    { value: "other", label: "Other" },
];

interface LogBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, the dialog is in edit mode */
    editBreakdown?: FleetBreakdown | null;
}

export function LogBreakdownDialog({ open, onOpenChange, editBreakdown }: LogBreakdownDialogProps) {
    const createBreakdown = useCreateFleetBreakdown();
    const updateBreakdown = useUpdateFleetBreakdown();
    const { data: vehicles = [] } = useVehicles();

    const [vehicleId, setVehicleId] = useState("");
    const [driverName, setDriverName] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [severity, setSeverity] = useState("medium");
    const [category, setCategory] = useState("mechanical");
    const [loadNumber, setLoadNumber] = useState("");
    const [workshopNotes, setWorkshopNotes] = useState("");

    // Pre-fill when editing
    useEffect(() => {
        if (editBreakdown && open) {
            setVehicleId(editBreakdown.vehicle_id ?? "");
            setDriverName(editBreakdown.driver_name ?? "");
            setDescription(editBreakdown.description);
            setLocation(editBreakdown.location ?? "");
            setSeverity(editBreakdown.severity);
            setCategory(editBreakdown.category);
            setLoadNumber(editBreakdown.load_number ?? "");
            setWorkshopNotes(editBreakdown.workshop_notes ?? "");
        } else if (!editBreakdown && open) {
            resetForm();
        }
    }, [editBreakdown, open]);

    const resetForm = () => {
        setVehicleId("");
        setDriverName("");
        setDescription("");
        setLocation("");
        setSeverity("medium");
        setCategory("mechanical");
        setLoadNumber("");
        setWorkshopNotes("");
    };

    const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            source_app: "dashboard",
            source_breakdown_id: null,
            source_breakdown_number: editBreakdown?.source_breakdown_number ?? `BD-${Date.now()}`,
            vehicle_id: vehicleId || null,
            vehicle_registration: selectedVehicle?.registration_number ?? null,
            vehicle_fleet_number: selectedVehicle?.fleet_number ?? null,
            vehicle_make: selectedVehicle?.make ?? null,
            vehicle_model: selectedVehicle?.model ?? null,
            driver_name: driverName || null,
            breakdown_date: editBreakdown?.breakdown_date ?? new Date().toISOString(),
            description: description.trim(),
            location: location.trim() || null,
            severity,
            category,
            load_number: loadNumber.trim() || null,
            status: editBreakdown?.status ?? "pending_review",
            linked_inspection_id: editBreakdown?.linked_inspection_id ?? null,
            linked_job_card_id: editBreakdown?.linked_job_card_id ?? null,
            workshop_notes: workshopNotes.trim() || null,
            reviewed_by: editBreakdown?.reviewed_by ?? null,
            reviewed_at: editBreakdown?.reviewed_at ?? null,
            call_out_departure_time: editBreakdown?.call_out_departure_time ?? null,
            call_out_start_time: editBreakdown?.call_out_start_time ?? null,
            call_out_completed_time: editBreakdown?.call_out_completed_time ?? null,
            call_out_mechanic: editBreakdown?.call_out_mechanic ?? null,
        };

        if (isEdit) {
            updateBreakdown.mutate(
                { id: editBreakdown!.id, ...payload },
                {
                    onSuccess: () => {
                        resetForm();
                        onOpenChange(false);
                    },
                }
            );
        } else {
            createBreakdown.mutate(payload, {
                onSuccess: () => {
                    resetForm();
                    onOpenChange(false);
                },
            });
        }
    };

    const isEdit = !!editBreakdown;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Breakdown" : "Log Breakdown"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the breakdown details below."
                            : "Record a new vehicle breakdown for workshop review."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vehicle</Label>
                            <Select value={vehicleId} onValueChange={setVehicleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select vehicle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.registration_number} {v.fleet_number ? `(${v.fleet_number})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="driver">Driver</Label>
                            <Input
                                id="driver"
                                placeholder="Driver name"
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe the breakdown..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                placeholder="Where did it happen?"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="loadNumber">Load Number</Label>
                            <Input
                                id="loadNumber"
                                placeholder="e.g. LD-12345"
                                value={loadNumber}
                                onChange={(e) => setLoadNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Severity *</Label>
                            <Select value={severity} onValueChange={setSeverity}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEVERITIES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Workshop Notes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Any additional notes..."
                            value={workshopNotes}
                            onChange={(e) => setWorkshopNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!description.trim() || createBreakdown.isPending || updateBreakdown.isPending}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {(createBreakdown.isPending || updateBreakdown.isPending)
                                ? isEdit ? "Saving..." : "Logging..."
                                : isEdit ? "Save Changes" : "Log Breakdown"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
