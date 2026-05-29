import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
    CalendarRange,
    FileSpreadsheet,
    FileText,
    Layers,
    Loader2,
    MapPin,
    Route,
    Truck,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogFooter,
} from "@/components/ui/dialog";
import { DialogHero } from "@/components/ui/dialog-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { supabase } from "@/integrations/supabase/client";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import { useCustomLocations } from "@/hooks/useCustomLocations";
import { DEPOTS } from "@/lib/depots";
import type { TelematicsGeofence } from "@/lib/telematicsGuru";
import {
    buildMovementRecords,
    exportMovementReportToExcel,
    exportMovementReportToPdf,
    type MovementReportFilters,
    type RawGeofenceEvent,
    type VehicleMeta,
} from "@/lib/exportVehicleMovementReport";

interface MovementReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    geofences: TelematicsGeofence[];
}

// Default to the trailing 30 days.
function defaultRange(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: iso(start), end: iso(end) };
}

const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geofenceEventsTable = () => (supabase as any).from("geofence_events");

export function MovementReportDialog({
    open,
    onOpenChange,
    geofences,
}: MovementReportDialogProps) {
    const { data: fleetVehicles = [] } = useFleetVehicles();
    const { data: customLocations = [] } = useCustomLocations();

    const range = useMemo(defaultRange, []);
    const [startDate, setStartDate] = useState(range.start);
    const [endDate, setEndDate] = useState(range.end);

    const [selectedFleetTypes, setSelectedFleetTypes] = useState<Set<string>>(new Set());
    const [allVehicles, setAllVehicles] = useState(true);
    const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
    const [allLocations, setAllLocations] = useState(true);
    const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());

    const [generating, setGenerating] = useState<"excel" | "pdf" | null>(null);

    // Distinct fleet types from the fleet.
    const fleetTypes = useMemo(() => {
        const set = new Set<string>();
        fleetVehicles.forEach((v) => v.type && set.add(v.type));
        return Array.from(set).sort();
    }, [fleetVehicles]);

    // Vehicles available for selection, optionally narrowed by selected fleets.
    const filteredVehicles = useMemo(() => {
        return fleetVehicles
            .filter((v) => selectedFleetTypes.size === 0 || selectedFleetTypes.has(v.type))
            .sort((a, b) => a.vehicle_id.localeCompare(b.vehicle_id));
    }, [fleetVehicles, selectedFleetTypes]);

    // Location options: telematics geofences + fixed depots + custom locations.
    const locationOptions = useMemo(() => {
        const set = new Set<string>();
        geofences.forEach((g) => g.name && set.add(g.name.trim()));
        DEPOTS.forEach((d) => set.add(d.name.trim()));
        customLocations.forEach((l) => l.name && set.add(l.name.trim()));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [geofences, customLocations]);

    const toggle = (set: Set<string>, value: string): Set<string> => {
        const next = new Set(set);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
    };

    async function fetchEvents(start: Date, end: Date): Promise<RawGeofenceEvent[]> {
        const events: RawGeofenceEvent[] = [];
        let page = 0;
        // Page through the table so large date ranges aren't silently truncated
        // by the default row limit.

        while (true) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, error } = await geofenceEventsTable()
                .select(
                    "event_type, geofence_name, vehicle_registration, telematics_asset_id, event_time, load_number, source",
                )
                .gte("event_time", start.toISOString())
                .lte("event_time", end.toISOString())
                .order("event_time", { ascending: true })
                .range(from, to);

            if (error) throw error;
            const rows = (data || []) as RawGeofenceEvent[];
            events.push(...rows);
            if (rows.length < PAGE_SIZE) break;
            page += 1;
        }
        return events;
    }

    // Resolve a telematics event to fleet metadata (fleet number, registration,
    // type). Falls back to the raw registration when no fleet vehicle matches.
    const buildResolver = () => {
        const byAsset = new Map<string, VehicleMeta>();
        const byReg = new Map<string, VehicleMeta>();
        for (const v of fleetVehicles) {
            const meta: VehicleMeta = {
                fleetNumber: v.vehicle_id,
                registration: v.registration_number || "—",
                type: v.type || "—",
            };
            if (v.telematics_asset_id) byAsset.set(String(v.telematics_asset_id), meta);
            if (v.registration_number) byReg.set(v.registration_number.toLowerCase(), meta);
        }
        return (ev: RawGeofenceEvent): VehicleMeta => {
            if (ev.telematics_asset_id && byAsset.has(String(ev.telematics_asset_id))) {
                return byAsset.get(String(ev.telematics_asset_id))!;
            }
            if (ev.vehicle_registration && byReg.has(ev.vehicle_registration.toLowerCase())) {
                return byReg.get(ev.vehicle_registration.toLowerCase())!;
            }
            return {
                fleetNumber: ev.vehicle_registration || "Unknown",
                registration: ev.vehicle_registration || "—",
                type: "Unknown",
            };
        };
    };

    async function handleGenerate(formatType: "excel" | "pdf") {
        // Validate filters.
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            toast.error("Please select a valid date range.");
            return;
        }
        if (start > end) {
            toast.error("Start date must be before the end date.");
            return;
        }
        if (!allVehicles && selectedVehicles.size === 0) {
            toast.error("Select at least one vehicle, or choose 'All vehicles'.");
            return;
        }
        if (!allLocations && selectedLocations.size === 0) {
            toast.error("Select at least one location, or choose 'All locations'.");
            return;
        }

        setGenerating(formatType);
        try {
            const events = await fetchEvents(start, end);
            const resolve = buildResolver();
            let records = buildMovementRecords(events, resolve);

            // Apply filters.
            if (selectedFleetTypes.size > 0) {
                records = records.filter((r) => selectedFleetTypes.has(r.vehicleType));
            }
            if (!allVehicles) {
                records = records.filter((r) => selectedVehicles.has(r.fleetNumber));
            }
            if (!allLocations) {
                records = records.filter((r) => selectedLocations.has(r.location));
            }

            if (records.length === 0) {
                toast.warning("No vehicle movements match the selected filters.");
                return;
            }

            const filters: MovementReportFilters = {
                startDate: start,
                endDate: end,
                fleetTypes: selectedFleetTypes.size > 0 ? Array.from(selectedFleetTypes) : "all",
                vehicles: allVehicles ? "all" : Array.from(selectedVehicles),
                locations: allLocations ? "all" : Array.from(selectedLocations),
            };

            if (formatType === "excel") {
                exportMovementReportToExcel(records, filters);
            } else {
                exportMovementReportToPdf(records, filters);
            }
            toast.success(
                `${formatType === "excel" ? "Excel" : "PDF"} report generated (${records.length} movements).`,
            );
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to generate report";
            toast.error(message);
        } finally {
            setGenerating(null);
        }
    }

    const busy = generating !== null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHero
                    icon={Route}
                    title="Vehicle Movement Report"
                    description="Generate a report of vehicle entry and exit times at depots and geofenced locations. Refine the results using the filters below."
                />

                <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="space-y-6 py-2">
                        {/* Date range */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold">
                                <CalendarRange className="h-4 w-4 text-primary" />
                                Date Range
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="mr-start" className="text-xs text-muted-foreground">
                                        From
                                    </Label>
                                    <Input
                                        id="mr-start"
                                        type="date"
                                        value={startDate}
                                        max={endDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="mr-end" className="text-xs text-muted-foreground">
                                        To
                                    </Label>
                                    <Input
                                        id="mr-end"
                                        type="date"
                                        value={endDate}
                                        min={startDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Fleets */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm font-semibold">
                                <Layers className="h-4 w-4 text-primary" />
                                Fleets
                                {selectedFleetTypes.size > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                        {selectedFleetTypes.size} selected
                                    </Badge>
                                )}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Leave all unchecked to include every fleet type.
                            </p>
                            {fleetTypes.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No fleet types available.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {fleetTypes.map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 text-sm cursor-pointer rounded-md border px-2.5 py-1.5 transition-colors hover:bg-muted/60 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
                                        >
                                            <Checkbox
                                                checked={selectedFleetTypes.has(type)}
                                                onCheckedChange={() => {
                                                    setSelectedFleetTypes((s) => toggle(s, type));
                                                    // Drop vehicle selections that fall outside the new fleet scope.
                                                    setSelectedVehicles(new Set());
                                                }}
                                            />
                                            <span className="truncate">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Vehicles */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-sm font-semibold">
                                    <Truck className="h-4 w-4 text-primary" />
                                    Vehicles
                                    {!allVehicles && selectedVehicles.size > 0 && (
                                        <Badge variant="secondary" className="ml-1">
                                            {selectedVehicles.size} selected
                                        </Badge>
                                    )}
                                </Label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={allVehicles}
                                        onCheckedChange={(c) => {
                                            const on = c === true;
                                            setAllVehicles(on);
                                            if (on) setSelectedVehicles(new Set());
                                        }}
                                    />
                                    <span>All vehicles</span>
                                </label>
                            </div>
                            {!allVehicles && (
                                <ScrollArea className="h-40 rounded-md border p-2">
                                    <div className="space-y-1">
                                        {filteredVehicles.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">
                                                No vehicles match the selected fleets.
                                            </p>
                                        ) : (
                                            filteredVehicles.map((v) => (
                                                <label
                                                    key={v.id}
                                                    className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1 transition-colors hover:bg-muted/60"
                                                >
                                                    <Checkbox
                                                        checked={selectedVehicles.has(v.vehicle_id)}
                                                        onCheckedChange={() =>
                                                            setSelectedVehicles((s) => toggle(s, v.vehicle_id))
                                                        }
                                                    />
                                                    <span className="truncate">
                                                        {v.vehicle_id}
                                                        {v.registration_number ? ` · ${v.registration_number}` : ""}
                                                        <span className="text-muted-foreground"> ({v.type})</span>
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>

                        <Separator />

                        {/* Locations */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-sm font-semibold">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    Locations
                                    {!allLocations && selectedLocations.size > 0 && (
                                        <Badge variant="secondary" className="ml-1">
                                            {selectedLocations.size} selected
                                        </Badge>
                                    )}
                                </Label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={allLocations}
                                        onCheckedChange={(c) => {
                                            const on = c === true;
                                            setAllLocations(on);
                                            if (on) setSelectedLocations(new Set());
                                        }}
                                    />
                                    <span>All locations</span>
                                </label>
                            </div>
                            {!allLocations && (
                                <ScrollArea className="h-40 rounded-md border p-2">
                                    <div className="space-y-1">
                                        {locationOptions.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">
                                                No locations available.
                                            </p>
                                        ) : (
                                            locationOptions.map((name) => (
                                                <label
                                                    key={name}
                                                    className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1 transition-colors hover:bg-muted/60"
                                                >
                                                    <Checkbox
                                                        checked={selectedLocations.has(name)}
                                                        onCheckedChange={() =>
                                                            setSelectedLocations((s) => toggle(s, name))
                                                        }
                                                    />
                                                    <span className="truncate">{name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleGenerate("excel")}
                        disabled={busy}
                    >
                        {generating === "excel" ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                        )}
                        Export Excel
                    </Button>
                    <Button onClick={() => handleGenerate("pdf")} disabled={busy}>
                        {generating === "pdf" ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileText className="w-4 h-4 mr-2" />
                        )}
                        Export PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
