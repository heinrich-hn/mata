import { CreateDieselOrderDialog } from "@/components/diesel/CreateDieselOrderDialog";
import { DieselOrderFilters } from "@/components/diesel/DieselOrderFilters";
import { DieselOrdersTable } from "@/components/diesel/DieselOrdersTable";
import { EditDieselOrderDialog } from "@/components/diesel/EditDieselOrderDialog";
import { CreateTruckStopOrderDialog } from "@/components/truckstops/CreateTruckStopOrderDialog";
import { EditTruckStopOrderDialog } from "@/components/truckstops/EditTruckStopOrderDialog";
import { TruckStopOrdersTable } from "@/components/truckstops/TruckStopOrdersTable";
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import type { DieselOrder } from "@/hooks/useDieselOrders";
import { useDieselOrders } from "@/hooks/useDieselOrders";
import { useTruckStopOrders } from "@/hooks/useTruckStopOrders";
import type { TruckStopOrder } from "@/hooks/useTruckStopOrders";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

function DieselOrdersTab() {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<DieselOrder | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: orders = [], isLoading } = useDieselOrders();

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const matchesSearch =
                !searchQuery ||
                order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.fuel_station.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.load?.load_id
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                order.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === "all" || order.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [orders, searchQuery, statusFilter]);

    const handleEditOrder = (order: DieselOrder) => {
        setSelectedOrder(order);
        setEditDialogOpen(true);
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create Order
                    </Button>
                </div>

                <DieselOrderFilters
                    onSearch={setSearchQuery}
                    onStatusFilter={setStatusFilter}
                />

                <DieselOrdersTable
                    orders={filteredOrders}
                    isLoading={isLoading}
                    onEditOrder={handleEditOrder}
                />
            </div>

            <CreateDieselOrderDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            <EditDieselOrderDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                order={selectedOrder}
            />
        </>
    );
}

function TruckStopOrdersTab() {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<TruckStopOrder | null>(
        null,
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: orders = [], isLoading } = useTruckStopOrders();

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const matchesSearch =
                !searchQuery ||
                order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.truck_stop.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.load?.load_id
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                order.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === "all" || order.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [orders, searchQuery, statusFilter]);

    const handleEditOrder = (order: TruckStopOrder) => {
        setSelectedOrder(order);
        setEditDialogOpen(true);
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create Order
                    </Button>
                </div>

                <DieselOrderFilters
                    onSearch={setSearchQuery}
                    onStatusFilter={setStatusFilter}
                />

                <TruckStopOrdersTable
                    orders={filteredOrders}
                    isLoading={isLoading}
                    onEditOrder={handleEditOrder}
                />
            </div>

            <CreateTruckStopOrderDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            <EditTruckStopOrderDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                order={selectedOrder}
            />
        </>
    );
}

export default function OrdersPage() {
    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
                <p className="text-muted-foreground">
                    Manage diesel orders and truck stop orders.
                </p>
            </div>

            <Tabs defaultValue="diesel" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="diesel">Diesel Orders</TabsTrigger>
                    <TabsTrigger value="truckstops">Truck Stops</TabsTrigger>
                </TabsList>

                <TabsContent value="diesel">
                    <DieselOrdersTab />
                </TabsContent>

                <TabsContent value="truckstops">
                    <TruckStopOrdersTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
