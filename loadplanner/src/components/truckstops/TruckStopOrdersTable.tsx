import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    type TruckStopOrder,
    useApproveTruckStopOrder,
    useDeleteTruckStopOrder,
} from "@/hooks/useTruckStopOrders";
import {
    exportTruckStopOrderToPdf,
    shareTruckStopViaWhatsApp,
} from "@/lib/exportTruckStopOrderToPdf";
import { safeFormatDate } from "@/lib/utils";
import {
    CheckCircle,
    FileText,
    Loader2,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react";

interface TruckStopOrdersTableProps {
    orders: TruckStopOrder[];
    isLoading: boolean;
    onEditOrder: (order: TruckStopOrder) => void;
}

const statusConfig: Record<
    string,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
    }
> = {
    pending: { label: "Pending", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    fulfilled: { label: "Fulfilled", variant: "outline" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function TruckStopOrdersTable({
    orders,
    isLoading,
    onEditOrder,
}: TruckStopOrdersTableProps) {
    const approveTruckStopOrder = useApproveTruckStopOrder();
    const deleteTruckStopOrder = useDeleteTruckStopOrder();

    const handleApprove = (order: TruckStopOrder) => {
        approveTruckStopOrder.mutate(order.id);
    };

    const handleDelete = (order: TruckStopOrder) => {
        if (confirm("Are you sure you want to delete this truck stop order?")) {
            deleteTruckStopOrder.mutate(order.id);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-orange-100 p-4 mb-4">
                    <MapPin className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold">No Truck Stop Orders</h3>
                <p className="text-muted-foreground mt-1">
                    Create your first truck stop order to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Truck Stop</TableHead>
                        <TableHead>Trip</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Fleet Number</TableHead>
                        <TableHead className="text-right">Cost/Night</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => (
                        <TableRow
                            key={order.id}
                            className="cursor-pointer hover:bg-muted/50"
                        >
                            <TableCell className="font-medium">
                                {order.order_number}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
                                    <span>{order.truck_stop}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                {order.load ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium">{order.load.load_id}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {order.load.origin} → {order.load.destination}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {order.recipient_name ? (
                                    <div className="flex flex-col">
                                        <span>{order.recipient_name}</span>
                                        {order.recipient_phone && (
                                            <span className="text-xs text-muted-foreground">
                                                {order.recipient_phone}
                                            </span>
                                        )}
                                    </div>
                                ) : order.driver ? (
                                    <div className="flex flex-col">
                                        <span>{order.driver.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {order.driver.contact}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {order.fleet_vehicle ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {order.fleet_vehicle.vehicle_id}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {order.fleet_vehicle.type}
                                        </span>
                                    </div>
                                ) : order.load?.fleet_vehicle ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {order.load.fleet_vehicle.vehicle_id}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {order.load.fleet_vehicle.type}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {order.cost_per_night != null ? (
                                    `$${order.cost_per_night.toFixed(2)}`
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={statusConfig[order.status]?.variant || "secondary"}
                                >
                                    {statusConfig[order.status]?.label || order.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {safeFormatDate(order.created_at, "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => exportTruckStopOrderToPdf(order)}
                                        >
                                            <FileText className="mr-2 h-4 w-4" />
                                            Export PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() =>
                                                shareTruckStopViaWhatsApp(
                                                    order,
                                                    order.recipient_phone ||
                                                    order.driver?.contact ||
                                                    order.load?.driver?.contact ||
                                                    undefined,
                                                )
                                            }
                                        >
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            Send WhatsApp
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => onEditOrder(order)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit Order
                                        </DropdownMenuItem>
                                        {order.status === "pending" && (
                                            <DropdownMenuItem onClick={() => handleApprove(order)}>
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                Approve Order
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => handleDelete(order)}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Order
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
