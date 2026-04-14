import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCreateReplenishmentRequest } from "@/hooks/useProcurement";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle, CheckSquare, Edit, FileText, Package, Plus, Search, Shield, ShieldAlert, ShieldCheck, ShoppingCart, Trash2, TrendingUp, Truck, Upload, X } from "lucide-react";
import { useState } from "react";
import AddInventoryItemDialog from "../dialogs/AddInventoryItemDialog";
import AddWarrantyItemDialog from "../dialogs/AddWarrantyItemDialog";
import InventoryImportModal from "../dialogs/InventoryImportModal";
import ProcurementFromInventoryDialog from "../dialogs/ProcurementFromInventoryDialog";
import RequestPartsDialog from "../dialogs/RequestPartsDialog";
import UpdateStockDialog from "../dialogs/UpdateStockDialog";
import WarrantyDialog from "../dialogs/WarrantyDialog";

interface InventoryItem {
  id: string;
  name: string;
  partNumber: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location: string;
  supplier: string;
  hasWarranty: boolean;
  warrantyPeriodMonths: number | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  warrantyProvider: string | null;
  warrantyTerms: string | null;
  warrantyClaimContact: string | null;
  warrantyNotes: string | null;
}

interface InventoryItemData {
  id: string;
  name: string;
  part_number: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit_price: number;
  location: string;
  supplier: string;
}

interface WarrantyItemRecord {
  id: string;
  name: string;
  part_number: string | null;
  serial_number: string | null;
  category: string | null;
  description: string | null;
  warranty_provider: string | null;
  warranty_period_months: number | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  warranty_terms: string | null;
  warranty_claim_contact: string | null;
  warranty_notes: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  supplier: string | null;
  invoice_number: string | null;
  job_card_id: string | null;
  vehicle_id?: string | null;  // Optional until migration is applied
  inventory_id: string | null;
  status: string;
  created_at: string | null;
  job_card?: {
    job_number: string;
    title: string;
    status: string;
  } | null;
  vehicle?: {
    fleet_number: string | null;
    registration_number: string;
    make: string | null;
    model: string | null;
  } | null;
}

interface RequestedPartServiceRecord {
  id: string;
  part_name: string;
  quantity: number;
  status: string;
  ir_number: string | null;
  is_service: boolean | null;
  is_from_inventory: boolean | null;
  created_at: string | null;
  unit_price: number | null;
  total_price: number | null;
  vendors?: {
    name: string;
  } | null;
  job_cards?: {
    job_number: string;
    title: string;
  } | null;
}

const InventoryPanel = () => {
  const { toast } = useToast();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [requestPartsOpen, setRequestPartsOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [warrantyDialogOpen, setWarrantyDialogOpen] = useState(false);
  const [addWarrantyItemDialogOpen, setAddWarrantyItemDialogOpen] = useState(false);
  const [procurementDialogOpen, setProcurementDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; quantity: number } | null>(null);
  const [procurementItem, setProcurementItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItemData | null>(null);
  const [warrantyItem, setWarrantyItem] = useState<InventoryItem | null>(null);
  const [editWarrantyItem, setEditWarrantyItem] = useState<WarrantyItemRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("inventory");
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<string>>(new Set());
  const [bulkReordering, setBulkReordering] = useState(false);

  const createReplenishmentRequest = useCreateReplenishmentRequest();

  const { data: inventory = [], refetch } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("name");

      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        name: item.name,
        partNumber: item.part_number,
        category: item.category,
        quantity: item.quantity,
        minQuantity: item.min_quantity,
        unitPrice: item.unit_price || 0,
        location: item.location || "",
        supplier: item.supplier || "",
        hasWarranty: (item as Record<string, unknown>).has_warranty as boolean || false,
        warrantyPeriodMonths: (item as Record<string, unknown>).warranty_period_months as number | null,
        warrantyStartDate: (item as Record<string, unknown>).warranty_start_date as string | null,
        warrantyEndDate: (item as Record<string, unknown>).warranty_end_date as string | null,
        warrantyProvider: (item as Record<string, unknown>).warranty_provider as string | null,
        warrantyTerms: (item as Record<string, unknown>).warranty_terms as string | null,
        warrantyClaimContact: (item as Record<string, unknown>).warranty_claim_contact as string | null,
        warrantyNotes: (item as Record<string, unknown>).warranty_notes as string | null,
      }));
    },
  });

  const { data: requestedPartsServices = [] } = useQuery<RequestedPartServiceRecord[]>({
    queryKey: ["inventory-requested-parts-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_requests")
        .select(`
          id,
          part_name,
          quantity,
          status,
          ir_number,
          is_service,
          is_from_inventory,
          created_at,
          unit_price,
          total_price,
          vendors(name),
          job_cards(job_number, title)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as RequestedPartServiceRecord[];
      return rows.filter((row) => row.is_service === true || row.is_from_inventory !== true);
    },
  });

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Query for standalone warranty items
  const { data: standaloneWarrantyItems = [], refetch: refetchWarrantyItems } = useQuery({
    queryKey: ["warranty-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warranty_items")
        .select(`
          *,
          job_card:job_cards(job_number, title, status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch vehicle data separately until FK migration is applied
      const items = (data || []) as unknown as WarrantyItemRecord[];
      // Try to enrich with vehicle data if vehicle_id exists
      for (const item of items) {
        if (item.vehicle_id) {
          const { data: vehicle } = await supabase
            .from("vehicles")
            .select("fleet_number, registration_number, make, model")
            .eq("id", item.vehicle_id)
            .single();
          if (vehicle) {
            item.vehicle = vehicle;
          }
        }
      }
      return items;
    },
  });

  const isLowStock = (item: InventoryItem) => item.quantity < item.minQuantity;
  const lowStockCount = filteredInventory.filter(isLowStock).length;
  const totalValue = filteredInventory.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const pendingRequestedCount = requestedPartsServices.filter((item) => item.status?.toLowerCase() === "pending").length;

  // Warranty calculations for inventory items
  const inventoryWarrantyItems = filteredInventory.filter(item => item.hasWarranty);
  const getWarrantyStatus = (item: InventoryItem) => {
    if (!item.hasWarranty || !item.warrantyEndDate) return "no_warranty";
    const daysUntilExpiry = differenceInDays(parseISO(item.warrantyEndDate), new Date());
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring_soon";
    return "active";
  };

  // Warranty status for standalone items
  const getStandaloneWarrantyStatus = (item: WarrantyItemRecord) => {
    if (item.status === "claimed" || item.status === "void") return item.status;
    if (!item.warranty_end_date) return "unknown";
    const daysUntilExpiry = differenceInDays(parseISO(item.warranty_end_date), new Date());
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring_soon";
    return "active";
  };

  // Combined warranty stats
  const invActiveCount = inventoryWarrantyItems.filter(item => getWarrantyStatus(item) === "active").length;
  const invExpiringSoonCount = inventoryWarrantyItems.filter(item => getWarrantyStatus(item) === "expiring_soon").length;
  const invExpiredCount = inventoryWarrantyItems.filter(item => getWarrantyStatus(item) === "expired").length;

  const standaloneActiveCount = standaloneWarrantyItems.filter(item => getStandaloneWarrantyStatus(item) === "active").length;
  const standaloneExpiringSoonCount = standaloneWarrantyItems.filter(item => getStandaloneWarrantyStatus(item) === "expiring_soon").length;
  const standaloneExpiredCount = standaloneWarrantyItems.filter(item => getStandaloneWarrantyStatus(item) === "expired").length;

  const totalWarrantyItems = inventoryWarrantyItems.length + standaloneWarrantyItems.length;
  const activeWarrantyCount = invActiveCount + standaloneActiveCount;
  const expiringSoonCount = invExpiringSoonCount + standaloneExpiringSoonCount;
  const expiredCount = invExpiredCount + standaloneExpiredCount;

  // Multi-select helpers
  const toggleInventorySelection = (id: string) => {
    setSelectedInventoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInventory = () => {
    if (selectedInventoryIds.size === filteredInventory.length) {
      setSelectedInventoryIds(new Set());
    } else {
      setSelectedInventoryIds(new Set(filteredInventory.map(i => i.id)));
    }
  };

  const clearInventorySelection = () => setSelectedInventoryIds(new Set());

  const handleBulkReorder = async () => {
    const selectedItems = filteredInventory.filter(i => selectedInventoryIds.has(i.id));
    if (selectedItems.length === 0) return;

    setBulkReordering(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of selectedItems) {
      try {
        const shortage = Math.max(item.minQuantity - item.quantity, item.minQuantity);
        await createReplenishmentRequest.mutateAsync({
          id: item.id,
          name: item.name,
          part_number: item.partNumber,
          category: item.category,
          quantity: item.quantity,
          min_quantity: item.minQuantity,
          unit_price: item.unitPrice,
          supplier: item.supplier || null,
          location: item.location || null,
          shortage,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkReordering(false);
    clearInventorySelection();

    if (failCount === 0) {
      toast({
        title: "Reorder Requests Created",
        description: `${successCount} item${successCount > 1 ? "s" : ""} sent to procurement.`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} created, ${failCount} failed.`,
        variant: "destructive",
      });
    }
  };

  const handleUpdateStock = (item: InventoryItem) => {
    setSelectedItem({ id: item.id, name: item.name, quantity: item.quantity });
    setUpdateDialogOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditItem({
      id: item.id,
      name: item.name,
      part_number: item.partNumber,
      category: item.category,
      quantity: item.quantity,
      min_quantity: item.minQuantity,
      unit_price: item.unitPrice,
      location: item.location,
      supplier: item.supplier,
    });
    setAddDialogOpen(true);
  };

  const handleManageWarranty = (item: InventoryItem) => {
    setWarrantyItem(item);
    setWarrantyDialogOpen(true);
  };

  const handleReorderItem = (item: InventoryItem) => {
    setProcurementItem(item);
    setProcurementDialogOpen(true);
  };

  const handleAddWarrantyItem = () => {
    setEditWarrantyItem(null);
    setAddWarrantyItemDialogOpen(true);
  };

  const handleEditWarrantyItem = (item: WarrantyItemRecord) => {
    setEditWarrantyItem(item);
    setAddWarrantyItemDialogOpen(true);
  };

  const handleDeleteWarrantyItem = async (item: WarrantyItemRecord) => {
    if (!confirm(`Are you sure you want to delete the warranty for "${item.name}"?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from("warranty_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Warranty item deleted successfully",
      });
      refetchWarrantyItems();
    } catch (error) {
      console.error("Error deleting warranty item:", error);
      toast({
        title: "Error",
        description: "Failed to delete warranty item",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = () => {
    setAddDialogOpen(false);
    setEditItem(null);
  };

  const handleWarrantyItemDialogClose = () => {
    setAddWarrantyItemDialogOpen(false);
    setEditWarrantyItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Inline stats toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">{filteredInventory.length}</span>
          <span className="text-xs text-muted-foreground">items</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span className="font-semibold">{lowStockCount}</span>
          <span className="text-xs text-muted-foreground">low stock</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">${totalValue.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">value</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">{requestedPartsServices.length}</span>
          <span className="text-xs text-muted-foreground">requested{pendingRequestedCount > 0 ? ` (${pendingRequestedCount} pending)` : ""}</span>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => setImportDialogOpen(true)}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          Import CSV
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => setRequestPartsOpen(true)}>
          <Package className="h-3.5 w-3.5 mr-1" />
          Request Parts
        </Button>
        <Button size="sm" className="h-8 text-xs px-2.5" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Item
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="inventory">
            <Package className="h-4 w-4 mr-2" />
            Parts Inventory
          </TabsTrigger>
          <TabsTrigger value="warranty">
            <Shield className="h-4 w-4 mr-2" />
            Warranty Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Parts Inventory</CardTitle>
                  <CardDescription>Current stock levels and locations</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search parts..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Selection bar */}
              {selectedInventoryIds.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">
                      {selectedInventoryIds.size} item{selectedInventoryIds.size > 1 ? "s" : ""} selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={clearInventorySelection}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  </div>
                  <Button
                    onClick={handleBulkReorder}
                    disabled={bulkReordering}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {bulkReordering ? "Creating..." : `Reorder Selected (${selectedInventoryIds.size})`}
                  </Button>
                </div>
              )}

              {/* Select all toggle */}
              {filteredInventory.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <Checkbox
                    checked={selectedInventoryIds.size === filteredInventory.length && filteredInventory.length > 0}
                    onCheckedChange={toggleAllInventory}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedInventoryIds.size === filteredInventory.length ? "Deselect all" : "Select all"}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No inventory items found. Add items to get started.
                  </div>
                ) : (
                  filteredInventory.map((item) => (
                    <Card key={item.id} className={`shadow-sm ${selectedInventoryIds.has(item.id) ? "ring-2 ring-primary" : ""}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedInventoryIds.has(item.id)}
                            onCheckedChange={() => toggleInventorySelection(item.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-foreground">{item.name}</h3>
                              {isLowStock(item) && (
                                <Badge variant="destructive" className="text-xs">
                                  Low Stock
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Part Number</p>
                                <p className="font-medium font-mono">{item.partNumber}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Category</p>
                                <p className="font-medium">{item.category}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Quantity</p>
                                <p className={`font-medium ${isLowStock(item) ? "text-warning" : ""}`}>
                                  {item.quantity} units
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Location</p>
                                <p className="font-medium">{item.location}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Unit Price: <span className="font-semibold text-foreground">${item.unitPrice.toFixed(2)}</span>
                                {item.hasWarranty && (
                                  <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Warranty
                                  </Badge>
                                )}
                              </span>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  variant={isLowStock(item) ? "default" : "outline"}
                                  onClick={() => handleReorderItem(item)}
                                  className={isLowStock(item) ? "bg-orange-600 hover:bg-orange-700" : ""}
                                >
                                  <ShoppingCart className="h-4 w-4 mr-1" />
                                  Reorder
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleManageWarranty(item)}>
                                  <Shield className="h-4 w-4 mr-1" />
                                  Warranty
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleEditItem(item)}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleUpdateStock(item)}>
                                  Update Stock
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card mt-4">
            <CardHeader>
              <CardTitle>Requested Parts & Services</CardTitle>
              <CardDescription>
                Requests created from job cards for external parts and service work (requires IR number).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requestedPartsServices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No requested external parts/services found.
                  </div>
                ) : (
                  requestedPartsServices.slice(0, 20).map((request) => (
                    <Card key={request.id} className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{request.part_name}</h4>
                              <Badge variant="outline" className={request.is_service ? "text-purple-700 border-purple-300" : "text-orange-700 border-orange-300"}>
                                {request.is_service ? "Service" : "External Part"}
                              </Badge>
                              <Badge variant="outline">Qty {request.quantity}</Badge>
                              <Badge variant={request.status?.toLowerCase() === "pending" ? "secondary" : "default"}>
                                {request.status}
                              </Badge>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                IR {request.ir_number || "N/A"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Vendor: <span className="font-medium text-foreground">{request.vendors?.name || "Not assigned"}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Job Card: <span className="font-medium text-foreground">{request.job_cards?.job_number || "N/A"}</span>
                              {request.job_cards?.title ? ` — ${request.job_cards.title}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Requested: {request.created_at ? new Date(request.created_at).toLocaleString() : "Unknown"}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-semibold">${(request.total_price || 0).toFixed(2)}</p>
                            {request.unit_price && (
                              <p className="text-xs text-muted-foreground">${request.unit_price.toFixed(2)} each</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty" className="mt-4">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Warranty Tracking</CardTitle>
                  <CardDescription>Track warranty status for parts and procured items</CardDescription>
                </div>
                <Button onClick={handleAddWarrantyItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Warranty Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Warranty Stats Summary */}
                {totalWarrantyItems > 0 && (
                  <div className="flex gap-4 flex-wrap">
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
                      <span className="text-2xl font-bold text-green-600">{activeWarrantyCount}</span>
                      <span className="text-sm text-green-600 ml-2">Active</span>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2">
                      <span className="text-2xl font-bold text-orange-600">{expiringSoonCount}</span>
                      <span className="text-sm text-orange-600 ml-2">Expiring Soon</span>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                      <span className="text-2xl font-bold text-red-600">{expiredCount}</span>
                      <span className="text-sm text-red-600 ml-2">Expired</span>
                    </div>
                  </div>
                )}
                {/* Standalone Warranty Items Section */}
                {standaloneWarrantyItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Manual Warranty Items ({standaloneWarrantyItems.length})
                    </h3>
                    {standaloneWarrantyItems.map((item) => {
                      const status = getStandaloneWarrantyStatus(item);
                      const daysUntilExpiry = item.warranty_end_date
                        ? differenceInDays(parseISO(item.warranty_end_date), new Date())
                        : null;

                      return (
                        <Card key={item.id} className="shadow-sm border-l-4 border-l-blue-500">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground">{item.name}</h3>
                                  {status === "active" && (
                                    <Badge variant="outline" className="text-green-600 border-green-300">
                                      <ShieldCheck className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  )}
                                  {status === "expiring_soon" && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                                      <ShieldAlert className="h-3 w-3 mr-1" />
                                      Expiring Soon
                                    </Badge>
                                  )}
                                  {status === "expired" && (
                                    <Badge variant="destructive">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Expired
                                    </Badge>
                                  )}
                                  {status === "claimed" && (
                                    <Badge variant="secondary">Claimed</Badge>
                                  )}
                                  {item.job_card && (
                                    <Badge variant="outline" className="text-purple-600 border-purple-300">
                                      <FileText className="h-3 w-3 mr-1" />
                                      {item.job_card.job_number} - {item.job_card.status}
                                    </Badge>
                                  )}
                                  {item.vehicle && (
                                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                                      <Truck className="h-3 w-3 mr-1" />
                                      {item.vehicle.fleet_number || item.vehicle.registration_number}
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Part / Serial #</p>
                                    <p className="font-medium font-mono">{item.part_number || item.serial_number || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Warranty Provider</p>
                                    <p className="font-medium">{item.warranty_provider || "Not specified"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Period</p>
                                    <p className="font-medium">{item.warranty_period_months ? `${item.warranty_period_months} months` : "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Expires</p>
                                    <p className={`font-medium ${status === "expired" ? "text-red-600" : status === "expiring_soon" ? "text-orange-600" : ""}`}>
                                      {item.warranty_end_date || "N/A"}
                                      {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                        <span className="text-xs text-muted-foreground ml-1">({daysUntilExpiry} days)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                {item.job_card && (
                                  <div className="mt-2 text-sm">
                                    <p className="text-muted-foreground">Linked Job Card:</p>
                                    <p className="font-medium">{item.job_card.job_number} - {item.job_card.title}</p>
                                  </div>
                                )}
                                {item.vehicle && (
                                  <div className="mt-2 text-sm">
                                    <p className="text-muted-foreground">Linked Vehicle:</p>
                                    <p className="font-medium">
                                      {item.vehicle.fleet_number && <span className="font-mono mr-2">[{item.vehicle.fleet_number}]</span>}
                                      {item.vehicle.registration_number} - {item.vehicle.make} {item.vehicle.model}
                                    </p>
                                  </div>
                                )}
                                {item.purchase_price && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    Purchase Price: <span className="font-medium text-foreground">${item.purchase_price.toFixed(2)}</span>
                                    {item.supplier && <span className="ml-2">from {item.supplier}</span>}
                                  </div>
                                )}
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">
                                    Contact: <span className="font-medium text-foreground">{item.warranty_claim_contact || "Not provided"}</span>
                                  </span>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditWarrantyItem(item)}>
                                      <Edit className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteWarrantyItem(item)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Inventory Warranty Items Section */}
                {inventoryWarrantyItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Inventory Items with Warranty ({inventoryWarrantyItems.length})
                    </h3>
                    {inventoryWarrantyItems.map((item) => {
                      const status = getWarrantyStatus(item);
                      const daysUntilExpiry = item.warrantyEndDate
                        ? differenceInDays(parseISO(item.warrantyEndDate), new Date())
                        : null;

                      return (
                        <Card key={item.id} className="shadow-sm">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-foreground">{item.name}</h3>
                                  <Badge variant="outline" className="text-gray-500 border-gray-300">
                                    <Package className="h-3 w-3 mr-1" />
                                    Inventory
                                  </Badge>
                                  {status === "active" && (
                                    <Badge variant="outline" className="text-green-600 border-green-300">
                                      <ShieldCheck className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  )}
                                  {status === "expiring_soon" && (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                                      <ShieldAlert className="h-3 w-3 mr-1" />
                                      Expiring Soon
                                    </Badge>
                                  )}
                                  {status === "expired" && (
                                    <Badge variant="destructive">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Expired
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Part Number</p>
                                    <p className="font-medium font-mono">{item.partNumber}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Warranty Provider</p>
                                    <p className="font-medium">{item.warrantyProvider || "Not specified"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Period</p>
                                    <p className="font-medium">{item.warrantyPeriodMonths ? `${item.warrantyPeriodMonths} months` : "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Expires</p>
                                    <p className={`font-medium ${status === "expired" ? "text-red-600" : status === "expiring_soon" ? "text-orange-600" : ""}`}>
                                      {item.warrantyEndDate || "N/A"}
                                      {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                        <span className="text-xs text-muted-foreground ml-1">({daysUntilExpiry} days)</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                {item.warrantyTerms && (
                                  <div className="mt-2 text-sm text-muted-foreground">
                                    <p className="font-medium">Terms:</p>
                                    <p>{item.warrantyTerms}</p>
                                  </div>
                                )}
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">
                                    Contact: <span className="font-medium text-foreground">{item.warrantyClaimContact || "Not provided"}</span>
                                  </span>
                                  <Button size="sm" variant="outline" onClick={() => handleManageWarranty(item)}>
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit Warranty
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Empty State */}
                {totalWarrantyItems === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No warranty items found.</p>
                    <p className="text-sm mt-2">Click "Add Warranty Item" to manually add a procured part with warranty, or add warranty info to inventory items.</p>
                    <Button className="mt-4" onClick={handleAddWarrantyItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Warranty Item
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UpdateStockDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        item={selectedItem}
        onUpdate={refetch}
      />
      <AddInventoryItemDialog
        open={addDialogOpen}
        onOpenChange={handleDialogClose}
        onAdd={refetch}
        editItem={editItem}
      />
      <RequestPartsDialog
        open={requestPartsOpen}
        onOpenChange={setRequestPartsOpen}
      />

      <InventoryImportModal
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={refetch}
      />

      <WarrantyDialog
        open={warrantyDialogOpen}
        onOpenChange={setWarrantyDialogOpen}
        item={warrantyItem ? {
          id: warrantyItem.id,
          name: warrantyItem.name,
          part_number: warrantyItem.partNumber,
          has_warranty: warrantyItem.hasWarranty,
          warranty_period_months: warrantyItem.warrantyPeriodMonths,
          warranty_start_date: warrantyItem.warrantyStartDate,
          warranty_end_date: warrantyItem.warrantyEndDate,
          warranty_provider: warrantyItem.warrantyProvider,
          warranty_terms: warrantyItem.warrantyTerms,
          warranty_claim_contact: warrantyItem.warrantyClaimContact,
          warranty_notes: warrantyItem.warrantyNotes,
        } : null}
        onUpdate={refetch}
      />

      <AddWarrantyItemDialog
        open={addWarrantyItemDialogOpen}
        onOpenChange={handleWarrantyItemDialogClose}
        onSuccess={refetchWarrantyItems}
        editItem={editWarrantyItem}
      />

      <ProcurementFromInventoryDialog
        open={procurementDialogOpen}
        onOpenChange={setProcurementDialogOpen}
        inventoryItem={procurementItem}
        onSuccess={refetch}
      />
    </div>
  );
};

export default InventoryPanel;