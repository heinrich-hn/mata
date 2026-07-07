import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDrivers } from "@/hooks/useDrivers";
import { useFleetVehicles } from "@/hooks/useFleetVehicles";
import {
    generateTruckStopOrderNumber,
    useCreateTruckStopOrder,
} from "@/hooks/useTruckStopOrders";
import { type Load, useLoads } from "@/hooks/useTrips";
import { TRUCK_STOPS } from "@/lib/truckStops";
import { safeFormatDate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultDateRange = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7);
    return { from: toISODate(from), to: toISODate(to) };
};

const formSchema = z
    .object({
        truck_stop: z.string().min(1, "Please select a truck stop"),
        fleet_vehicle_id: z.string().min(1, "Please select a truck"),
        date_from: z.string().min(1, "Start date is required"),
        date_to: z.string().min(1, "End date is required"),
        load_id: z.string().min(1, "Please select a trip"),
        driver_id: z.string().min(1, "Please select a driver"),
        cost_per_night: z.string().optional(),
        notes: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.date_from && data.date_to && data.date_from > data.date_to) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["date_to"],
                message: "End date must be on or after the start date.",
            });
        }
    });

type FormData = z.infer<typeof formSchema>;

interface CreateTruckStopOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When set, the dialog opens pre-filled for this trip (e.g. from the loads table actions menu). */
    preselectedLoadId?: string;
}

export function CreateTruckStopOrderDialog({
    open,
    onOpenChange,
    preselectedLoadId,
}: CreateTruckStopOrderDialogProps) {
    const { data: loads = [], isLoading: loadsLoading } = useLoads();
    const { data: drivers = [], isLoading: driversLoading } = useDrivers();
    const { data: fleetVehicles = [], isLoading: vehiclesLoading } =
        useFleetVehicles();
    const createTruckStopOrder = useCreateTruckStopOrder();
    const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);

    const defaults = getDefaultDateRange();

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            truck_stop: "",
            fleet_vehicle_id: "",
            date_from: defaults.from,
            date_to: defaults.to,
            load_id: "",
            driver_id: "",
            cost_per_night: "",
            notes: "",
        },
    });

    const watchedVehicleId = form.watch("fleet_vehicle_id");
    const watchedDateFrom = form.watch("date_from");
    const watchedDateTo = form.watch("date_to");
    const watchedLoadId = form.watch("load_id");

    // Only show trips for the selected vehicle whose date window overlaps the
    // chosen range. Sorted most-recent first so the current trip for the period
    // and the most recently completed trip surface at the top.
    const relevantLoads = useMemo(() => {
        if (!watchedVehicleId || !watchedDateFrom || !watchedDateTo) return [];

        const fromTime = new Date(`${watchedDateFrom}T00:00:00`).getTime();
        const toTime = new Date(`${watchedDateTo}T23:59:59`).getTime();
        if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return [];

        return loads
            .filter((load) => load.fleet_vehicle_id === watchedVehicleId)
            .filter((load) => {
                const start = new Date(load.loading_date).getTime();
                const endRaw = new Date(
                    load.offloading_date || load.loading_date,
                ).getTime();
                if (Number.isNaN(start)) return false;
                const end = Number.isNaN(endRaw) ? start : endRaw;
                // Overlap of [start, end] with [fromTime, toTime]
                return start <= toTime && end >= fromTime;
            })
            .sort(
                (a, b) =>
                    new Date(b.loading_date).getTime() -
                    new Date(a.loading_date).getTime(),
            );
    }, [loads, watchedVehicleId, watchedDateFrom, watchedDateTo]);

    // Clear the selected trip if it is no longer in the relevant set
    useEffect(() => {
        if (
            watchedLoadId &&
            !relevantLoads.some((load) => load.id === watchedLoadId)
        ) {
            form.setValue("load_id", "");
        }
    }, [relevantLoads, watchedLoadId, form]);

    // Auto-fill driver from the selected trip
    useEffect(() => {
        if (watchedLoadId) {
            const load = loads.find((l) => l.id === watchedLoadId);
            setSelectedLoad(load || null);
            if (load?.driver?.id) {
                form.setValue("driver_id", load.driver.id);
            }
        } else {
            setSelectedLoad(null);
        }
    }, [watchedLoadId, loads, form]);

    // Reset to a fresh form each time the dialog opens. When a trip is
    // preselected, pre-fill the vehicle/trip and widen the date range so the
    // trip passes the relevance filter. Initialise only once per open so a
    // background loads refetch never wipes user input.
    const initRef = useRef(false);
    useEffect(() => {
        if (!open) {
            initRef.current = false;
            return;
        }
        if (initRef.current) return;

        const preselected = preselectedLoadId
            ? loads.find((l) => l.id === preselectedLoadId)
            : undefined;
        // Wait for loads to arrive before initialising a preselected trip
        if (preselectedLoadId && !preselected && loadsLoading) return;
        initRef.current = true;

        const next = getDefaultDateRange();
        if (preselected) {
            const startIso =
                (preselected.loading_date || "").slice(0, 10) || next.from;
            const endIso =
                (preselected.offloading_date || preselected.loading_date || "")
                    .slice(0, 10) || next.to;
            form.reset({
                truck_stop: "",
                fleet_vehicle_id: preselected.fleet_vehicle_id || "",
                date_from: startIso < next.from ? startIso : next.from,
                date_to: endIso > next.to ? endIso : next.to,
                load_id: preselected.id,
                driver_id: preselected.driver?.id || "",
                cost_per_night: "",
                notes: "",
            });
            setSelectedLoad(preselected);
        } else {
            form.reset({
                truck_stop: "",
                fleet_vehicle_id: "",
                date_from: next.from,
                date_to: next.to,
                load_id: "",
                driver_id: "",
                cost_per_night: "",
                notes: "",
            });
            setSelectedLoad(null);
        }
    }, [open, preselectedLoadId, loads, loadsLoading, form]);

    const handleSubmit = (data: FormData) => {
        const selectedDriver = drivers.find((d) => d.id === data.driver_id);

        createTruckStopOrder.mutate(
            {
                order_number: generateTruckStopOrderNumber(),
                truck_stop: data.truck_stop,
                load_id: data.load_id,
                driver_id: data.driver_id,
                fleet_vehicle_id: data.fleet_vehicle_id,
                recipient_name: selectedDriver?.name || null,
                recipient_phone: selectedDriver?.contact || null,
                cost_per_night:
                    data.cost_per_night && data.cost_per_night.trim() !== ""
                        ? Number(data.cost_per_night)
                        : null,
                notes: data.notes?.trim() || null,
                status: "approved",
            },
            {
                onSuccess: () => {
                    form.reset();
                    onOpenChange(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-orange-500" />
                        Create Truck Stop Order
                    </DialogTitle>
                    <DialogDescription>
                        Assign a truck stop to a specific truck, driver, and existing trip.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-6"
                    >
                        {/* Truck Stop */}
                        <FormField
                            control={form.control}
                            name="truck_stop"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Truck Stop *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a truck stop" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {TRUCK_STOPS.length === 0 ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    No truck stops available
                                                </div>
                                            ) : (
                                                TRUCK_STOPS.map((stop) => (
                                                    <SelectItem key={stop.name} value={stop.name}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{stop.name}</span>
                                                            {stop.address && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {stop.address}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Truck (Fleet Vehicle) */}
                        <FormField
                            control={form.control}
                            name="fleet_vehicle_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Truck *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select truck" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vehiclesLoading ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    Loading vehicles...
                                                </div>
                                            ) : fleetVehicles.length === 0 ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    No vehicles available
                                                </div>
                                            ) : (
                                                fleetVehicles.map((vehicle) => (
                                                    <SelectItem key={vehicle.id} value={vehicle.id}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {vehicle.vehicle_id}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {vehicle.type} - {vehicle.make_model || "N/A"}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date_from"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>From Date *</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="date_to"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>To Date *</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Trip Selection (filtered by vehicle + date range) */}
                        <FormField
                            control={form.control}
                            name="load_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Trip *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a trip" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {!watchedVehicleId ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    Select a truck first
                                                </div>
                                            ) : loadsLoading ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    Loading trips...
                                                </div>
                                            ) : relevantLoads.length === 0 ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    No trips for this truck in the selected date range
                                                </div>
                                            ) : (
                                                relevantLoads.map((load) => (
                                                    <SelectItem key={load.id} value={load.id}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">
                                                                {load.load_id}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {load.origin} → {load.destination} |{" "}
                                                                {safeFormatDate(load.loading_date, "dd MMM")}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Only trips for the selected truck within the date range are
                                        shown.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Selected Trip Details */}
                        {selectedLoad && (
                            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                                <h4 className="font-medium text-sm">Trip Details</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Route:</span>
                                        <span className="ml-2">
                                            {selectedLoad.origin} → {selectedLoad.destination}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Date:</span>
                                        <span className="ml-2">
                                            {safeFormatDate(selectedLoad.loading_date, "dd MMM yyyy")}
                                        </span>
                                    </div>
                                    {selectedLoad.driver && (
                                        <div>
                                            <span className="text-muted-foreground">Driver:</span>
                                            <span className="ml-2">{selectedLoad.driver.name}</span>
                                        </div>
                                    )}
                                    {selectedLoad.fleet_vehicle && (
                                        <div>
                                            <span className="text-muted-foreground">Vehicle:</span>
                                            <span className="ml-2">
                                                {selectedLoad.fleet_vehicle.vehicle_id}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Driver */}
                        <FormField
                            control={form.control}
                            name="driver_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Driver *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select driver" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {driversLoading ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    Loading drivers...
                                                </div>
                                            ) : drivers.length === 0 ? (
                                                <div className="p-2 text-center text-muted-foreground">
                                                    No drivers available
                                                </div>
                                            ) : (
                                                drivers.map((driver) => (
                                                    <SelectItem key={driver.id} value={driver.id}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{driver.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {driver.contact}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Cost per Night */}
                        <FormField
                            control={form.control}
                            name="cost_per_night"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost per Night (USD) (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Notes */}
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional instructions or notes..."
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
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createTruckStopOrder.isPending}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {createTruckStopOrder.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Create Order
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
