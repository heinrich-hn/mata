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
import {
    type TruckStopOrder,
    type TruckStopOrderStatus,
    useUpdateTruckStopOrder,
} from "@/hooks/useTruckStopOrders";
import { TRUCK_STOPS } from "@/lib/truckStops";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPin } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    truck_stop: z.string().min(1, "Please select a truck stop"),
    recipient_name: z.string().optional(),
    recipient_phone: z.string().optional(),
    cost_per_night: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["pending", "approved", "cancelled"]),
});

type FormData = z.infer<typeof formSchema>;

interface EditTruckStopOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: TruckStopOrder | null;
}

export function EditTruckStopOrderDialog({
    open,
    onOpenChange,
    order,
}: EditTruckStopOrderDialogProps) {
    const updateTruckStopOrder = useUpdateTruckStopOrder();

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            truck_stop: "",
            recipient_name: "",
            recipient_phone: "",
            cost_per_night: "",
            notes: "",
            status: "approved",
        },
    });

    // Reset form when order changes
    useEffect(() => {
        if (order) {
            const status: TruckStopOrderStatus =
                order.status === "fulfilled" ? "approved" : order.status;
            form.reset({
                truck_stop: order.truck_stop,
                recipient_name: order.recipient_name || "",
                recipient_phone: order.recipient_phone || "",
                cost_per_night:
                    order.cost_per_night != null ? String(order.cost_per_night) : "",
                notes: order.notes || "",
                status: status as "pending" | "approved" | "cancelled",
            });
        }
    }, [order, form]);

    const handleSubmit = (data: FormData) => {
        if (!order) return;

        updateTruckStopOrder.mutate(
            {
                id: order.id,
                truck_stop: data.truck_stop,
                recipient_name: data.recipient_name?.trim() || null,
                recipient_phone: data.recipient_phone?.trim() || null,
                cost_per_night:
                    data.cost_per_night && data.cost_per_night.trim() !== ""
                        ? Number(data.cost_per_night)
                        : null,
                notes: data.notes?.trim() || null,
                status: data.status,
            },
            {
                onSuccess: () => {
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
                        Edit Truck Stop Order
                    </DialogTitle>
                    <DialogDescription>
                        {order ? `Update order ${order.order_number}.` : ""}
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
                                            {TRUCK_STOPS.map((stop) => (
                                                <SelectItem key={stop.name} value={stop.name}>
                                                    {stop.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Recipient */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="recipient_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Recipient Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Recipient name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="recipient_phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Recipient Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Recipient phone" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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

                        {/* Status */}
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="approved">Approved</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                disabled={updateTruckStopOrder.isPending}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {updateTruckStopOrder.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
