import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import type { CustomLocation } from "@/hooks/useCustomLocations";
import { DEPOTS } from "@/lib/depots";
import type { Waypoint, WaypointType } from "@/types/Trips";
import { cn } from "@/lib/utils";
import {
    Check,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Clock,
    MapPin,
    Plus,
    Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const WAYPOINT_TYPE_OPTIONS: { value: WaypointType; label: string; color: string }[] = [
    { value: "pickup", label: "Pickup", color: "bg-green-100 text-green-700 border-green-300" },
    { value: "delivery", label: "Delivery", color: "bg-blue-100 text-blue-700 border-blue-300" },
    { value: "border", label: "Border Crossing", color: "bg-red-100 text-red-700 border-red-300" },
    { value: "stop", label: "Truck Stop", color: "bg-amber-100 text-amber-700 border-amber-300" },
    { value: "other", label: "Other", color: "bg-gray-100 text-gray-700 border-gray-300" },
];

function getWaypointTypeOption(type: WaypointType) {
    return WAYPOINT_TYPE_OPTIONS.find((o) => o.value === type) ?? WAYPOINT_TYPE_OPTIONS[4];
}

interface WaypointsSectionProps {
    waypoints: Waypoint[];
    onChange: (waypoints: Waypoint[]) => void;
    customLocations?: CustomLocation[];
    origin?: string;
    destination?: string;
}

function generateId() {
    return crypto.randomUUID();
}

// Mini depot combobox for waypoint location selection
function WaypointDepotCombobox({
    value,
    onChange,
    customLocations = [],
}: {
    value: string;
    onChange: (value: string) => void;
    customLocations?: CustomLocation[];
}) {
    const [open, setOpen] = useState(false);

    const locationsByCountry = useMemo(() => {
        const map: Record<string, { id: string; name: string; type: string; isCustom?: boolean }[]> = {};
        DEPOTS.forEach((depot) => {
            const key = depot.country;
            if (!map[key]) map[key] = [];
            map[key].push({ id: depot.id, name: depot.name, type: depot.type });
        });
        customLocations.forEach((loc) => {
            const key = loc.country ?? "Other";
            if (!map[key]) map[key] = [];
            map[key].push({ id: loc.id, name: loc.name, type: loc.type ?? "custom", isCustom: true });
        });
        return map;
    }, [customLocations]);

    const allLocations = useMemo(() => [
        ...DEPOTS.map((d) => ({ id: d.id, name: d.name })),
        ...customLocations.map((loc) => ({ id: loc.id, name: loc.name })),
    ], [customLocations]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal h-8 text-xs"
                >
                    <span className="truncate">
                        {value
                            ? allLocations.find((loc) => loc.name === value)?.name ?? value
                            : "Select location..."}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 max-w-[--radix-popover-trigger-width]">
                <Command>
                    <CommandInput placeholder="Search locations..." />
                    <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        {Object.keys(locationsByCountry)
                            .sort()
                            .map((country) => (
                                <CommandGroup key={country} heading={country}>
                                    {locationsByCountry[country]
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((loc) => (
                                            <CommandItem
                                                key={loc.id}
                                                value={loc.name}
                                                onSelect={() => {
                                                    onChange(loc.name);
                                                    setOpen(false);
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-3 w-3",
                                                        value === loc.name ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <span className="text-xs">{loc.name}</span>
                                                {loc.isCustom && (
                                                    <span className="ml-auto text-[10px] text-muted-foreground">★</span>
                                                )}
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function WaypointsSection({
    waypoints,
    onChange,
    customLocations = [],
    origin,
    destination,
}: WaypointsSectionProps) {
    const addWaypoint = useCallback(() => {
        onChange([
            ...waypoints,
            {
                id: generateId(),
                placeName: "",
                type: "stop",
                plannedArrival: "",
                plannedDeparture: "",
                notes: "",
            },
        ]);
    }, [waypoints, onChange]);

    const removeWaypoint = useCallback(
        (id: string) => {
            onChange(waypoints.filter((wp) => wp.id !== id));
        },
        [waypoints, onChange]
    );

    const updateWaypoint = useCallback(
        (id: string, updates: Partial<Waypoint>) => {
            onChange(
                waypoints.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp))
            );
        },
        [waypoints, onChange]
    );

    const moveWaypoint = useCallback(
        (index: number, direction: -1 | 1) => {
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= waypoints.length) return;
            const updated = [...waypoints];
            [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
            onChange(updated);
        },
        [waypoints, onChange]
    );

    return (
        <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
            <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <MapPin className="h-4 w-4" />
                    Additional Stops
                    {waypoints.length > 0 && (
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                            {waypoints.length}
                        </Badge>
                    )}
                </h4>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWaypoint}
                    className="gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/40"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Stop
                </Button>
            </div>

            {/* Trip sequence overview */}
            {waypoints.length > 0 && (origin || destination) && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs px-2 py-1.5 rounded bg-white dark:bg-gray-900 border border-orange-100 dark:border-orange-800/30">
                    {origin && (
                        <span className="font-medium text-green-700 dark:text-green-400">{origin}</span>
                    )}
                    {waypoints.filter(wp => wp.placeName).map((wp, i) => (
                        <span key={wp.id} className="flex items-center gap-1.5">
                            <span className="text-orange-400">→</span>
                            <span className="inline-flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-[8px] font-bold text-orange-600 dark:text-orange-400">{i + 1}</span>
                                <span className="font-medium text-orange-700 dark:text-orange-400">{wp.placeName}</span>
                            </span>
                        </span>
                    ))}
                    {destination && (
                        <span className="flex items-center gap-1.5">
                            <span className="text-orange-400">→</span>
                            <span className="font-medium text-blue-700 dark:text-blue-400">{destination}</span>
                        </span>
                    )}
                </div>
            )}

            {waypoints.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    Add intermediate stops such as extra pickups, deliveries, border crossings, or truck stops.
                </p>
            )}

            <div className="space-y-3">
                {waypoints.map((waypoint, index) => {
                    const typeOption = getWaypointTypeOption(waypoint.type);
                    return (
                        <div
                            key={waypoint.id}
                            className="relative p-3 bg-white dark:bg-gray-900 rounded-md border border-orange-200 dark:border-orange-800/50 space-y-2"
                        >
                            {/* Header row */}
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => moveWaypoint(index, -1)}
                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={index === waypoints.length - 1}
                                        onClick={() => moveWaypoint(index, 1)}
                                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-semibold shrink-0">
                                    Stop {index + 1}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={cn("text-[10px] shrink-0", typeOption.color)}
                                >
                                    {typeOption.label}
                                </Badge>
                                <div className="flex-1" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeWaypoint(waypoint.id)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {/* Type + Location */}
                            <div className="grid grid-cols-[140px_1fr] gap-2">
                                <Select
                                    value={waypoint.type}
                                    onValueChange={(val) =>
                                        updateWaypoint(waypoint.id, { type: val as WaypointType })
                                    }
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WAYPOINT_TYPE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <WaypointDepotCombobox
                                    value={waypoint.placeName}
                                    onChange={(val) =>
                                        updateWaypoint(waypoint.id, { placeName: val })
                                    }
                                    customLocations={customLocations}
                                />
                            </div>

                            {/* Address + Times */}
                            <div className="grid grid-cols-3 gap-2">
                                <Input
                                    placeholder="Address (optional)"
                                    value={waypoint.address ?? ""}
                                    onChange={(e) =>
                                        updateWaypoint(waypoint.id, { address: e.target.value })
                                    }
                                    className="h-8 text-xs"
                                />
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <Input
                                        type="time"
                                        value={waypoint.plannedArrival ?? ""}
                                        onChange={(e) =>
                                            updateWaypoint(waypoint.id, {
                                                plannedArrival: e.target.value,
                                            })
                                        }
                                        className="h-8 text-xs"
                                        placeholder="Arr"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <Input
                                        type="time"
                                        value={waypoint.plannedDeparture ?? ""}
                                        onChange={(e) =>
                                            updateWaypoint(waypoint.id, {
                                                plannedDeparture: e.target.value,
                                            })
                                        }
                                        className="h-8 text-xs"
                                        placeholder="Dep"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <Input
                                placeholder="Notes (optional)"
                                value={waypoint.notes ?? ""}
                                onChange={(e) =>
                                    updateWaypoint(waypoint.id, { notes: e.target.value })
                                }
                                className="h-8 text-xs"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
