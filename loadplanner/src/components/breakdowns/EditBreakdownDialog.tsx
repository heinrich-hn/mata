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
import { useUpdateBreakdown } from "@/hooks/useBreakdowns";
import { useDrivers } from "@/hooks/useDrivers";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useLoads } from "@/hooks/useTrips";
import {
    BREAKDOWN_CATEGORIES,
    BREAKDOWN_SEVERITIES,
    BREAKDOWN_STATUSES,
    type Breakdown,
    type BreakdownCategory,
    type BreakdownSeverity,
    type BreakdownStatus,
} from "@/types/breakdown";
import { useEffect, useMemo, useState } from "react";
import { parseISO, startOfDay } from "date-fns";

interface EditBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    breakdown: Breakdown | null;
}

// Sentinel value used by the trip selector to represent "no linked trip"
// (Radix Select items cannot use an empty-string value).
const NO_TRIP = "__none__";

export function EditBreakdownDialog({ open, onOpenChange, breakdown }: EditBreakdownDialogProps) {
    const updateBreakdown = useUpdateBreakdown();
    const { data: loads = [] } = useLoads();
    const { data: vehicles = [] } = useFleetVehicles();
    const { data: drivers = [] } = useDrivers();

    const [loadId, setLoadId] = useState<string>(NO_TRIP);
    const [vehicleId, setVehicleId] = useState<string>("");
    const [driverId, setDriverId] = useState<string>("");
    const [breakdownDate, setBreakdownDate] = useState<string>("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [severity, setSeverity] = useState<BreakdownSeverity>("medium");
    const [category, setCategory] = useState<BreakdownCategory>("mechanical");
    const [status, setStatus] = useState<BreakdownStatus>("reported");
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [reportedBy, setReportedBy] = useState("");

    // Hydrate form state whenever a new breakdown is opened for editing.
    useEffect(() => {
        if (!breakdown) return;
        setLoadId(breakdown.load_id ?? NO_TRIP);
        setVehicleId(breakdown.fleet_vehicle_id ?? "");
        setDriverId(breakdown.driver_id ?? "");
        // <input type="datetime-local"> expects "yyyy-MM-ddTHH:mm"
        setBreakdownDate(
            breakdown.breakdown_date ? breakdown.breakdown_date.slice(0, 16) : ""
        );
        setDescription(breakdown.description ?? "");
        setLocation(breakdown.location ?? "");
        setSeverity(breakdown.severity);
        setCategory(breakdown.category);
        setStatus(breakdown.status);
        setResolutionNotes(breakdown.resolution_notes ?? "");
        setReportedBy(breakdown.reported_by ?? "");
    }, [breakdown]);

    // When the trip is reassigned, record the breakdown against that trip's
    // fleet vehicle & driver so the breakdown reflects the fleet that was
    // actually running the trip when it broke down.
    const handleTripChange = (value: string) => {
        setLoadId(value);
        if (value === NO_TRIP) return;
        const trip = loads.find((l) => l.id === value);
        if (trip) {
            if (trip.fleet_vehicle?.id) setVehicleId(trip.fleet_vehicle.id);
            if (trip.driver?.id) setDriverId(trip.driver.id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!breakdown) return;

        updateBreakdown.mutate(
            {
                id: breakdown.id,
                load_id: loadId === NO_TRIP ? null : loadId,
                fleet_vehicle_id: vehicleId || null,
                driver_id: driverId || null,
                breakdown_date: breakdownDate
                    ? new Date(breakdownDate).toISOString()
                    : breakdown.breakdown_date,
                description,
                location: location || null,
                severity,
                category,
                status,
                resolution_notes: resolutionNotes || null,
                reported_by: reportedBy || null,
                ...(status === "resolved" && !breakdown.resolved_at
                    ? { resolved_at: new Date().toISOString() }
                    : {}),
            },
            {
                onSuccess: () => onOpenChange(false),
            }
        );
    };

    const selectedTrip = loadId === NO_TRIP ? null : loads.find((l) => l.id === loadId);

    // Only offer trips that match the breakdown's vehicle AND that were running
    // on the breakdown date (the date falls between the trip's loading and
    // offloading dates). This keeps the selector relevant instead of listing
    // every trip in the system.
    const availableTrips = useMemo(() => {
        if (!vehicleId || !breakdownDate) return [];
        const bdDay = startOfDay(new Date(breakdownDate));
        return loads.filter((l) => {
            if (l.fleet_vehicle_id !== vehicleId) return false;
            const start = startOfDay(parseISO(l.loading_date));
            const end = startOfDay(parseISO(l.offloading_date || l.loading_date));
            return bdDay >= start && bdDay <= end;
        });
    }, [loads, vehicleId, breakdownDate]);

    // Ensure the currently linked trip is always selectable even if it falls
    // outside the date/vehicle filter (e.g. historical data).
    const tripOptions = useMemo(() => {
        if (selectedTrip && !availableTrips.some((l) => l.id === selectedTrip.id)) {
            return [selectedTrip, ...availableTrips];
        }
        return availableTrips;
    }, [availableTrips, selectedTrip]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Breakdown</DialogTitle>
                    <DialogDescription>
                        {breakdown
                            ? `Update breakdown ${breakdown.breakdown_number} — reassign the trip it occurred on and adjust its details.`
                            : "Update breakdown details."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Trip reassignment */}
                    <div className="space-y-2">
                        <Label>Trip / Load</Label>
                        <Select value={loadId} onValueChange={handleTripChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select the trip where the breakdown occurred" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_TRIP}>No linked trip</SelectItem>
                                {tripOptions.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.load_id} — {l.origin} → {l.destination}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!vehicleId || !breakdownDate ? (
                            <p className="text-xs text-muted-foreground">
                                Select a vehicle and breakdown date to see matching trips.
                            </p>
                        ) : tripOptions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No trips for this vehicle on the breakdown date.
                            </p>
                        ) : null}
                        {selectedTrip && (
                            <p className="text-xs text-muted-foreground">
                                Fleet on this trip:{" "}
                                <span className="font-medium">
                                    {selectedTrip.fleet_vehicle?.vehicle_id ?? "Unassigned"}
                                </span>
                                {selectedTrip.driver?.name ? ` · ${selectedTrip.driver.name}` : ""}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vehicle *</Label>
                            <Select value={vehicleId} onValueChange={setVehicleId}>
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
                            <Select value={driverId} onValueChange={setDriverId}>
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
                        <Label htmlFor="edit-breakdown-date">Date & Time</Label>
                        <Input
                            id="edit-breakdown-date"
                            type="datetime-local"
                            value={breakdownDate}
                            onChange={(e) => setBreakdownDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Description *</Label>
                        <Textarea
                            id="edit-description"
                            placeholder="Describe the breakdown"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-location">Location</Label>
                        <Input
                            id="edit-location"
                            placeholder="Where did the breakdown occur?"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
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

                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as BreakdownStatus)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BREAKDOWN_STATUSES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-resolution">Resolution Notes</Label>
                        <Textarea
                            id="edit-resolution"
                            placeholder="How was the breakdown resolved?"
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-reported-by">Reported By</Label>
                        <Input
                            id="edit-reported-by"
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
                            disabled={!description.trim() || !vehicleId || updateBreakdown.isPending}
                        >
                            {updateBreakdown.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
