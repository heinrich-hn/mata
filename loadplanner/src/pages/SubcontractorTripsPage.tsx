import { DeliveryConfirmationDialog } from "@/components/trips/DeliveryConfirmationDialog";
import { LoadsTable } from "@/components/trips/LoadsTable";
import { QuickFilters } from "@/components/trips/QuickFilters";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveSuppliers } from "@/hooks/useSuppliers";
import {
    generateLoadId,
    useCreateLoad,
    useDeleteLoad,
    useLoads,
    useUpdateLoad,
    type Load,
} from "@/hooks/useTrips";
import {
    exportLoadsToExcel,
    exportLoadsToExcelSimplified,
} from "@/lib/exportTripsToExcel";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import {
    CalendarIcon,
    Check,
    ChevronDown,
    ChevronsUpDown,
    Clock,
    FileSpreadsheet,
    Loader2,
    MapPin,
    Plus,
    Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";

// Depot selection imports
import { AddLocationDialog } from "@/components/tracking/AddLocationDialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useCustomLocations, type CustomLocation } from "@/hooks/useCustomLocations";
import { DEPOTS } from "@/lib/depots";

// Edit dialog — reuse the same component used for third-party loads
import { EditThirdPartyLoadDialog } from "@/components/trips/EditThirdPartyLoadDialog";

// ============================================================================
// Depot combobox (same pattern as ThirdPartyTripsPage)
// ============================================================================

interface LocationItem {
    id: string;
    name: string;
    type: string;
    isCustom?: boolean;
}

const DepotCombobox: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    customLocations?: CustomLocation[];
}> = ({ value, onChange, placeholder = "Select a depot...", customLocations = [] }) => {
    const [open, setOpen] = useState(false);

    const locationsByCountry = useMemo(() => {
        const map: Record<string, LocationItem[]> = {};
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

    const allLocations = useMemo(() => {
        const all: LocationItem[] = DEPOTS.map((d) => ({ id: d.id, name: d.name, type: d.type }));
        customLocations.forEach((loc) => {
            all.push({ id: loc.id, name: loc.name, type: loc.type ?? "custom", isCustom: true });
        });
        return all;
    }, [customLocations]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value
                        ? allLocations.find((loc) => loc.name === value)?.name ?? value
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                        "mr-2 h-4 w-4",
                                                        value === loc.name ? "opacity-100" : "opacity-0",
                                                    )}
                                                />
                                                {loc.name}
                                                <span className="ml-auto text-xs text-muted-foreground">
                                                    {loc.isCustom ? `★ ${loc.type}` : loc.type}
                                                </span>
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

// ============================================================================
// Form schema
// ============================================================================

const formSchema = z.object({
    priority: z.enum(["high", "medium", "low"]),
    supplierId: z.string().min(1, "Supplier is required"),
    loadingDate: z.date({ required_error: "Loading date is required" }),
    offloadingDate: z.date({ required_error: "Offloading date is required" }),
    loadingPlaceName: z.string().min(1, "Loading place name is required"),
    loadingAddress: z.string().optional(),
    offloadingPlaceName: z.string().min(1, "Offloading place name is required"),
    offloadingAddress: z.string().optional(),
    loadingPlannedArrival: z.string().min(1, "Planned arrival time is required"),
    loadingPlannedDeparture: z.string().min(1, "Planned departure time is required"),
    offloadingPlannedArrival: z.string().min(1, "Planned arrival time is required"),
    offloadingPlannedDeparture: z.string().min(1, "Planned departure time is required"),
    cargoDescription: z.string().min(1, "Cargo description is required"),
    fleetVehicleId: z.string().optional(),
    driverId: z.string().optional(),
    notes: z.string(),
});

type FormData = z.infer<typeof formSchema>;

// ============================================================================
// Page component
// ============================================================================

export default function SubcontractorTripsPage() {
    const [searchParams] = useSearchParams();
    const preselectedSupplierId = searchParams.get("supplier") ?? "";

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
    const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
    const [addLocationDialogOpen, setAddLocationDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [originFilter, setOriginFilter] = useState("all");
    const [weekFilter, setWeekFilter] = useState<{ start: Date | null; end: Date | null }>({
        start: null,
        end: null,
    });

    const { data: loads = [], isLoading } = useLoads();
    const { data: suppliers = [] } = useActiveSuppliers();
    const { data: customLocations = [] } = useCustomLocations();
    const createLoad = useCreateLoad();
    const _updateLoad = useUpdateLoad();
    const _deleteLoad = useDeleteLoad();

    // Filter for subcontractor loads: SC- prefix OR has subcontractor info in time_window
    const subcontractorLoads = useMemo(
        () => loads.filter((load) => {
            if (load.load_id.startsWith("SC-")) return true;
            try {
                const raw = typeof load.time_window === "string"
                    ? JSON.parse(load.time_window || "{}")
                    : (load.time_window ?? {});
                return !!raw.subcontractor?.supplierId;
            } catch {
                return false;
            }
        }),
        [loads],
    );

    // Apply filters
    const filteredLoads = subcontractorLoads.filter((load) => {
        const matchesSearch =
            !searchQuery ||
            load.load_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            load.driver?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            load.origin.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || load.status === statusFilter;
        const matchesOrigin = originFilter === "all" || load.origin === originFilter;

        let matchesWeek = true;
        if (weekFilter.start && weekFilter.end) {
            try {
                const loadDate = startOfDay(parseISO(load.loading_date));
                matchesWeek = isWithinInterval(loadDate, {
                    start: startOfDay(weekFilter.start),
                    end: weekFilter.end,
                });
            } catch {
                matchesWeek = false;
            }
        }

        return matchesSearch && matchesStatus && matchesOrigin && matchesWeek;
    });

    const handleWeekFilter = (weekStart: Date | null, weekEnd: Date | null) => {
        setWeekFilter({ start: weekStart, end: weekEnd });
    };

    const handleEditLoad = (load: Load) => {
        setSelectedLoad(load);
        setEditDialogOpen(true);
    };

    const handleConfirmDelivery = (load: Load) => {
        setSelectedLoad(load);
        setDeliveryDialogOpen(true);
    };

    const handleLoadClick = (load: Load) => {
        setSelectedLoad(load);
        setEditDialogOpen(true);
    };

    const handleExportExcel = (simplified = false) => {
        if (simplified) {
            exportLoadsToExcelSimplified(filteredLoads);
        } else {
            exportLoadsToExcel(filteredLoads);
        }
    };

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            priority: "medium",
            supplierId: preselectedSupplierId,
            loadingPlaceName: "",
            loadingAddress: "",
            offloadingPlaceName: "",
            offloadingAddress: "",
            loadingPlannedArrival: "08:00",
            loadingPlannedDeparture: "10:00",
            offloadingPlannedArrival: "14:00",
            offloadingPlannedDeparture: "16:00",
            cargoDescription: "",
            fleetVehicleId: "",
            driverId: "",
            notes: "",
        },
    });

    // When dialog opens with preselected supplier, set it
    const openCreateDialog = () => {
        if (preselectedSupplierId) {
            form.setValue("supplierId", preselectedSupplierId);
        }
        setCreateDialogOpen(true);
    };

    const handleSubmit = (data: FormData) => {
        const supplier = suppliers.find((s) => s.id === data.supplierId);
        if (!supplier) return;

        const timeData = {
            origin: {
                plannedArrival: data.loadingPlannedArrival,
                plannedDeparture: data.loadingPlannedDeparture,
                placeName: data.loadingPlaceName,
                address: data.loadingAddress,
            },
            destination: {
                plannedArrival: data.offloadingPlannedArrival,
                plannedDeparture: data.offloadingPlannedDeparture,
                placeName: data.offloadingPlaceName,
                address: data.offloadingAddress,
            },
            subcontractor: {
                supplierId: supplier.id,
                supplierName: supplier.name,
                cargoDescription: data.cargoDescription,
            },
        };

        createLoad.mutate(
            {
                load_id: generateLoadId("SC"),
                loading_date: format(data.loadingDate, "yyyy-MM-dd"),
                offloading_date: format(data.offloadingDate, "yyyy-MM-dd"),
                origin: data.loadingPlaceName,
                destination: data.offloadingPlaceName,
                cargo_type: "Retail",
                priority: data.priority,
                status: "scheduled",
                fleet_vehicle_id: data.fleetVehicleId || null,
                driver_id: data.driverId || null,
                time_window: JSON.stringify(timeData),
                notes: data.notes,
            },
            {
                onSuccess: () => {
                    setCreateDialogOpen(false);
                    form.reset();
                },
            },
        );
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setAddLocationDialogOpen(true)}
                            className="gap-2"
                        >
                            <MapPin className="h-4 w-4" />
                            Add Location
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    disabled={filteredLoads.length === 0}
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Export to Excel
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExportExcel(false)}>
                                    Full Export (All Columns)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportExcel(true)}>
                                    Simplified Export
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            onClick={openCreateDialog}
                            className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Subcontractor Trip
                        </Button>
                    </div>
                </header>

                <QuickFilters
                    onSearch={setSearchQuery}
                    onStatusFilter={setStatusFilter}
                    onOriginFilter={setOriginFilter}
                    onWeekFilter={handleWeekFilter}
                />

                <LoadsTable
                    loads={filteredLoads}
                    isLoading={isLoading}
                    onLoadClick={handleLoadClick}
                    onEditLoad={handleEditLoad}
                    onConfirmDelivery={handleConfirmDelivery}
                />
            </div>

            {/* Create Subcontractor Trip Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-accent" />
                            Create Subcontractor Trip
                        </DialogTitle>
                        <DialogDescription>
                            Schedule a trip assigned to a subcontractor / supplier
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            {/* Supplier Selection */}
                            <div className="space-y-4">
                                <h4 className="font-medium">Supplier / Subcontractor</h4>
                                <FormField
                                    control={form.control}
                                    name="supplierId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel htmlFor="supplier">Supplier</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger id="supplier">
                                                        <SelectValue placeholder="Select a supplier" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {suppliers.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>
                                                            {s.name} ({s.supplier_number})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="loadingDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel htmlFor="loadingDate">Loading Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            id="loadingDate"
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground",
                                                            )}
                                                        >
                                                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="offloadingDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel htmlFor="offloadingDate">Offloading Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            id="offloadingDate"
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground",
                                                            )}
                                                        >
                                                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Loading Location */}
                            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                                <h4 className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <Truck className="h-4 w-4" />
                                    Loading Location
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="loadingPlaceName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="loadingPlace">Depot / Location</FormLabel>
                                                <FormControl>
                                                    <DepotCombobox
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="Select loading depot..."
                                                        customLocations={customLocations}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="loadingAddress"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="loadingAddress">Address (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input id="loadingAddress" placeholder="Custom address" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="loadingPlannedArrival"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="loadingArrival" className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Arrival Time
                                                </FormLabel>
                                                <FormControl>
                                                    <Input id="loadingArrival" type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="loadingPlannedDeparture"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="loadingDeparture" className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Departure Time
                                                </FormLabel>
                                                <FormControl>
                                                    <Input id="loadingDeparture" type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Offloading Location */}
                            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                                <h4 className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                    <MapPin className="h-4 w-4" />
                                    Offloading Location
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="offloadingPlaceName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="offloadingPlace">Depot / Location</FormLabel>
                                                <FormControl>
                                                    <DepotCombobox
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="Select offloading depot..."
                                                        customLocations={customLocations}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="offloadingAddress"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="offloadingAddress">Address (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input id="offloadingAddress" placeholder="Custom address" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="offloadingPlannedArrival"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="offloadingArrival" className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Arrival Time
                                                </FormLabel>
                                                <FormControl>
                                                    <Input id="offloadingArrival" type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="offloadingPlannedDeparture"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel htmlFor="offloadingDeparture" className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    Departure Time
                                                </FormLabel>
                                                <FormControl>
                                                    <Input id="offloadingDeparture" type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Cargo & Assignment */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="cargoDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel htmlFor="cargoDescription">Cargo Description</FormLabel>
                                            <FormControl>
                                                <Input
                                                    id="cargoDescription"
                                                    placeholder="What is being transported?"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel htmlFor="priority">Priority</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger id="priority">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="high">High</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="low">Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>



                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="notes">Notes (Optional)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                id="notes"
                                                placeholder="Any additional notes..."
                                                className="resize-none"
                                                rows={3}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCreateDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createLoad.isPending || !form.watch("supplierId")}
                                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                                >
                                    {createLoad.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Create Trip
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Edit Load Dialog */}
            <EditThirdPartyLoadDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                load={selectedLoad}
            />

            {/* Delivery Confirmation Dialog */}
            <DeliveryConfirmationDialog
                open={deliveryDialogOpen}
                onOpenChange={setDeliveryDialogOpen}
                load={selectedLoad}
            />

            {/* Add Location Dialog */}
            <AddLocationDialog
                open={addLocationDialogOpen}
                onOpenChange={setAddLocationDialogOpen}
            />
        </>
    );
}
