import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { type Load, useUpdateLoad } from "@/hooks/useTrips";
import { useActiveSuppliers } from "@/hooks/useSuppliers";
import { parseTimeWindow } from "@/lib/timeWindow";
import { cn, getLocationDisplayName } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Handshake, MapPin, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    supplierId: z.string().min(1, "Supplier is required"),
    cargoDescription: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AssignSubcontractorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load: Load | null;
}

export function AssignSubcontractorDialog({
    open,
    onOpenChange,
    load,
}: AssignSubcontractorDialogProps) {
    const updateLoad = useUpdateLoad();
    const { data: suppliers = [] } = useActiveSuppliers();
    const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            supplierId: "",
            cargoDescription: "",
        },
    });

    // Pre-fill form when load changes or dialog opens
    useEffect(() => {
        if (load && open) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const raw: any =
                    typeof load.time_window === "string"
                        ? JSON.parse(load.time_window || "{}")
                        : (load.time_window ?? {});

                if (raw.subcontractor?.supplierId) {
                    form.reset({
                        supplierId: raw.subcontractor.supplierId,
                        cargoDescription: raw.subcontractor.cargoDescription || "",
                    });
                } else {
                    form.reset({ supplierId: "", cargoDescription: "" });
                }
            } catch {
                form.reset({ supplierId: "", cargoDescription: "" });
            }
        }
    }, [load, open, form]);

    const handleSubmit = (data: FormData) => {
        if (!load) return;

        const supplier = suppliers.find((s) => s.id === data.supplierId);
        if (!supplier) return;

        // Parse existing time_window to preserve all existing data
        const existingTimeData = parseTimeWindow(load.time_window);

        const timeData = {
            origin: {
                plannedArrival: existingTimeData.origin.plannedArrival,
                plannedDeparture: existingTimeData.origin.plannedDeparture,
                actualArrival: existingTimeData.origin.actualArrival,
                actualDeparture: existingTimeData.origin.actualDeparture,
            },
            destination: {
                plannedArrival: existingTimeData.destination.plannedArrival,
                plannedDeparture: existingTimeData.destination.plannedDeparture,
                actualArrival: existingTimeData.destination.actualArrival,
                actualDeparture: existingTimeData.destination.actualDeparture,
            },
            ...(existingTimeData.backload
                ? { backload: existingTimeData.backload }
                : {}),
            ...(existingTimeData.thirdParty
                ? { thirdParty: existingTimeData.thirdParty }
                : {}),
            ...(existingTimeData.varianceReason
                ? { varianceReason: existingTimeData.varianceReason }
                : {}),
            subcontractor: {
                supplierId: supplier.id,
                supplierName: supplier.name,
                cargoDescription: data.cargoDescription || "",
            },
        };

        updateLoad.mutate(
            {
                id: load.id,
                time_window: JSON.stringify(timeData),
            },
            {
                onSuccess: () => {
                    form.reset();
                    onOpenChange(false);
                },
            }
        );
    };

    const selectedSupplier = suppliers.find(
        (s) => s.id === form.watch("supplierId")
    );

    if (!load) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
                            <Handshake className="h-4 w-4" />
                        </span>
                        Assign to Subcontractor
                    </DialogTitle>
                    <DialogDescription>
                        Assign load{" "}
                        <span className="font-semibold">{load.load_id}</span> to a
                        supplier / subcontractor.
                    </DialogDescription>
                </DialogHeader>

                {/* Current Load Summary */}
                <div className="rounded-lg border bg-muted/50 p-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Vehicle</p>
                            <p className="font-medium">
                                {load.fleet_vehicle?.vehicle_id || "Unassigned"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Route</p>
                            <p className="font-medium">
                                {getLocationDisplayName(load.origin)} →{" "}
                                {getLocationDisplayName(load.destination)}
                            </p>
                        </div>
                    </div>
                </div>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-5"
                    >
                        {/* Supplier combobox */}
                        <FormField
                            control={form.control}
                            name="supplierId"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Supplier / Subcontractor</FormLabel>
                                    <Popover
                                        open={supplierPopoverOpen}
                                        onOpenChange={setSupplierPopoverOpen}
                                    >
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "w-full justify-between",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {selectedSupplier
                                                        ? selectedSupplier.name
                                                        : "Select supplier…"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search suppliers…" />
                                                <CommandList>
                                                    <CommandEmpty>No suppliers found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {suppliers.map((supplier) => (
                                                            <CommandItem
                                                                key={supplier.id}
                                                                value={supplier.name}
                                                                onSelect={() => {
                                                                    field.onChange(supplier.id);
                                                                    setSupplierPopoverOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        field.value === supplier.id
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <div>
                                                                    <p className="font-medium">{supplier.name}</p>
                                                                    {supplier.contact_person && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {supplier.contact_person}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Cargo description */}
                        <FormField
                            control={form.control}
                            name="cargoDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cargo Description (optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe the cargo or any special instructions…"
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={updateLoad.isPending}
                                className="bg-indigo-500 hover:bg-indigo-600"
                            >
                                {updateLoad.isPending
                                    ? "Assigning…"
                                    : selectedSupplier
                                        ? "Assign Subcontractor"
                                        : "Assign"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
