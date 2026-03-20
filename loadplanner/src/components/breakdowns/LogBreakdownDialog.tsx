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
import { useCreateBreakdown } from "@/hooks/useBreakdowns";
import { useDrivers } from "@/hooks/useDrivers";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import type { Load } from "@/hooks/useTrips";
import {
    BREAKDOWN_CATEGORIES,
    BREAKDOWN_SEVERITIES,
    type BreakdownCategory,
    type BreakdownSeverity,
} from "@/types/breakdown";
import { useEffect, useState } from "react";

interface LogBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load?: Load | null;
}

export function LogBreakdownDialog({ open, onOpenChange, load }: LogBreakdownDialogProps) {
    const createBreakdown = useCreateBreakdown();
    const { data: vehicles = [] } = useFleetVehicles();
    const { data: drivers = [] } = useDrivers();

    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [severity, setSeverity] = useState<BreakdownSeverity>("medium");
    const [category, setCategory] = useState<BreakdownCategory>("mechanical");
    const [reportedBy, setReportedBy] = useState("");
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
    const [selectedDriverId, setSelectedDriverId] = useState<string>("");

    // Pre-fill vehicle/driver when load is provided
    useEffect(() => {
        if (load) {
            setSelectedVehicleId(load.fleet_vehicle?.id ?? "");
            setSelectedDriverId(load.driver?.id ?? "");
        }
    }, [load]);

    const resetForm = () => {
        setDescription("");
        setLocation("");
        setSeverity("medium");
        setCategory("mechanical");
        setReportedBy("");
        setSelectedVehicleId("");
        setSelectedDriverId("");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        createBreakdown.mutate(
            {
                load_id: load?.id ?? null,
                fleet_vehicle_id: selectedVehicleId || null,
                driver_id: selectedDriverId || null,
                breakdown_date: new Date().toISOString(),
                description,
                location: location || null,
                severity,
                category,
                reported_by: reportedBy || null,
            },
            {
                onSuccess: () => {
                    resetForm();
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Log Breakdown</DialogTitle>
                    <DialogDescription>
                        {load
                            ? `Report a breakdown for load ${load.load_id} — ${load.fleet_vehicle?.vehicle_id ?? "No vehicle"}`
                            : "Report a vehicle breakdown"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {load && (
                        <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Load</span>
                                <span className="font-medium">{load.load_id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Route</span>
                                <span className="font-medium">{load.origin} → {load.destination}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vehicle *</Label>
                            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select vehicle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.vehicle_id} ({v.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Driver</Label>
                            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select driver" />
                                </SelectTrigger>
                                <SelectContent>
                                    {drivers.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe the breakdown (e.g., engine overheating on N1 highway...)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            placeholder="Where did the breakdown occur?"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Severity *</Label>
                            <Select value={severity} onValueChange={(v) => setSeverity(v as BreakdownSeverity)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BREAKDOWN_SEVERITIES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as BreakdownCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BREAKDOWN_CATEGORIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reportedBy">Reported By</Label>
                        <Input
                            id="reportedBy"
                            placeholder="Name of person reporting"
                            value={reportedBy}
                            onChange={(e) => setReportedBy(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!description.trim() || createBreakdown.isPending}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {createBreakdown.isPending ? "Logging..." : "Log Breakdown"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
