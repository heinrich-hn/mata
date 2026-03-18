import { CreateDieselOrderDialog } from "@/components/diesel/CreateDieselOrderDialog";
import { DieselOrderFilters } from "@/components/diesel/DieselOrderFilters";
import { DieselOrdersTable } from "@/components/diesel/DieselOrdersTable";
import { EditDieselOrderDialog } from "@/components/diesel/EditDieselOrderDialog";
import { Button } from "@/components/ui/button";
import type { DieselOrder } from "@/hooks/useDieselOrders";
import { useDieselOrders } from "@/hooks/useDieselOrders";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export default function DieselOrdersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DieselOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: orders = [], isLoading } = useDieselOrders();

  // Filter orders
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
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex justify-end">
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
        </div>

        {/* Filters */}
        <DieselOrderFilters
          onSearch={setSearchQuery}
          onStatusFilter={setStatusFilter}
        />

        {/* Orders Table */}
        <DieselOrdersTable
          orders={filteredOrders}
          isLoading={isLoading}
          onEditOrder={handleEditOrder}
        />
      </div>

      {/* Dialogs */}
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