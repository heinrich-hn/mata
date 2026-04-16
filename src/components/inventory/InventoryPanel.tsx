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
import { AlertTriangle, CheckSquare, Edit, FileText, Package, Plus, Search, Shield, ShieldAlert, ShieldCheck, ShoppingCart, Trash2, TrendingUp, Upload, X } from "lucide-react";
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
  vehicle_id?: string | null;
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
      const items = (data || []) as unknown as WarrantyItemRecord[];
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

  const inventoryWarrantyItems = filteredInventory.filter(item => item.hasWarranty);
  const getWarrantyStatus = (item: InventoryItem) => {
    if (!item.hasWarranty || !item.warrantyEndDate) return "no_warranty";
    const daysUntilExpiry = differenceInDays(parseISO(item.warrantyEndDate), new Date());
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring_soon";
    return "active";
  };

  const getStandaloneWarrantyStatus = (item: WarrantyItemRecord) => {
    if (item.status === "claimed" || item.status === "void") return item.status;
    if (!item.warranty_end_date) return "unknown";
    const daysUntilExpiry = differenceInDays(parseISO(item.warranty_end_date), new Date());
    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "expiring_soon";
    return "active";
  };

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

              {/* COMPACT INVENTORY LIST */}
              <div className="space-y-2">
                {filteredInventory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No inventory items found. Add items to get started.
                  </div>
                ) : (
                  filteredInventory.map((item) => (
                    <div 
                      key={item.id} 
                      className={`border rounded-lg p-3 hover:bg-muted/30 transition-colors ${
                        selectedInventoryIds.has(item.id) ? "ring-2 ring-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedInventoryIds.has(item.id)}
                          onCheckedChange={() => toggleInventorySelection(item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                            <span className="text-xs text-muted-foreground font-mono">{item.partNumber}</span>
                            {isLowStock(item) && (
                              <Badge variant="destructive" className="text-xs py-0 h-5">
                                Low Stock
                              </Badge>
                            )}
                            {item.hasWarranty && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs py-0 h-5">
                                <ShieldCheck className="h-3 w-3 mr-0.5" />
                                Warranty
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs mb-2">
                            <span className="text-muted-foreground">
                              Category: <span className="font-medium text-foreground">{item.category}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Qty: <span className={`font-medium ${isLowStock(item) ? "text-warning" : "text-foreground"}`}>
                                {item.quantity} units
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Min: <span className="font-medium text-foreground">{item.minQuantity}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Location: <span className="font-medium text-foreground">{item.location}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Price: <span className="font-semibold text-foreground">${item.unitPrice.toFixed(2)}</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={isLowStock(item) ? "default" : "ghost"}
                              onClick={() => handleReorderItem(item)}
                              className={`h-7 text-xs px-2 ${isLowStock(item) ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                              Reorder
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleManageWarranty(item)} className="h-7 text-xs px-2">
                              <Shield className="h-3.5 w-3.5 mr-1" />
                              Warranty
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEditItem(item)} className="h-7 text-xs px-2">
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateStock(item)} className="h-7 text-xs px-2">
                              Update Stock
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card mt-4">
            <CardHeader className="pb-3">
              <CardTitle>Requested Parts & Services</CardTitle>
              <CardDescription>
                Requests created from job cards for external parts and service work (requires IR number).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {requestedPartsServices.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No requested external parts/services found.
                  </div>
                ) : (
                  requestedPartsServices.slice(0, 20).map((request) => (
                    <div key={request.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <h4 className="font-semibold text-sm truncate">{request.part_name}</h4>
                            <Badge variant="outline" className={`text-xs py-0 h-5 ${request.is_service ? "text-purple-700 border-purple-300" : "text-orange-700 border-orange-300"}`}>
                              {request.is_service ? "Service" : "External Part"}
                            </Badge>
                            <Badge variant="outline" className="text-xs py-0 h-5">Qty {request.quantity}</Badge>
                            <Badge variant={request.status?.toLowerCase() === "pending" ? "secondary" : "default"} className="text-xs py-0 h-5">
                              {request.status}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-0 h-5">
                              IR {request.ir_number || "N/A"}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">
                              Vendor: <span className="font-medium text-foreground">{request.vendors?.name || "Not assigned"}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Job Card: <span className="font-medium text-foreground">{request.job_cards?.job_number || "N/A"}</span>
                              {request.job_cards?.title && <span className="text-muted-foreground ml-1">— {request.job_cards.title}</span>}
                            </span>
                            <span className="text-muted-foreground">
                              Requested: {request.created_at ? new Date(request.created_at).toLocaleDateString() : "Unknown"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right text-xs shrink-0">
                          <p className="font-semibold">${(request.total_price || 0).toFixed(2)}</p>
                          {request.unit_price && (
                            <p className="text-muted-foreground">${request.unit_price.toFixed(2)} ea</p>
                          )}
                        </div>
                      </div>
                    </div>
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
              <div className="space-y-4">
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
                
                {standaloneWarrantyItems.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Manual Warranty Items ({standaloneWarrantyItems.length})
                    </h3>
                    {standaloneWarrantyItems.map((item) => {
                      const status = getStandaloneWarrantyStatus(item);
                      const daysUntilExpiry = item.warranty_end_date
                        ? differenceInDays(parseISO(item.warranty_end_date), new Date())
                        : null;

                      return (
                        <div key={item.id} className="border rounded-lg p-3 border-l-4 border-l-blue-500 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                {status === "active" && (
                                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs py-0 h-5">
                                    <ShieldCheck className="h-3 w-3 mr-0.5" />
                                    Active
                                  </Badge>
                                )}
                                {status === "expiring_soon" && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs py-0 h-5">
                                    <ShieldAlert className="h-3 w-3 mr-0.5" />
                                    Expiring Soon
                                  </Badge>
                                )}
                                {status === "expired" && (
                                  <Badge variant="destructive" className="text-xs py-0 h-5">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    Expired
                                  </Badge>
                                )}
                                {status === "claimed" && (
                                  <Badge variant="secondary" className="text-xs py-0 h-5">Claimed</Badge>
                                )}
                                {item.job_card && (
                                  <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs py-0 h-5">
                                    <FileText className="h-3 w-3 mr-0.5" />
                                    {item.job_card.job_number}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs mb-2">
                                <span className="text-muted-foreground">
                                  Part/Serial: <span className="font-medium text-foreground font-mono">{item.part_number || item.serial_number || "N/A"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Provider: <span className="font-medium text-foreground">{item.warranty_provider || "Not specified"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Period: <span className="font-medium text-foreground">{item.warranty_period_months ? `${item.warranty_period_months} mo` : "N/A"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Expires: <span className={`font-medium ${status === "expired" ? "text-red-600" : status === "expiring_soon" ? "text-orange-600" : "text-foreground"}`}>
                                    {item.warranty_end_date || "N/A"}
                                    {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                      <span className="text-muted-foreground ml-1">({daysUntilExpiry}d)</span>
                                    )}
                                  </span>
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEditWarrantyItem(item)} className="h-7 text-xs px-2">
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 h-7 text-xs px-2" onClick={() => handleDeleteWarrantyItem(item)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {inventoryWarrantyItems.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Inventory Items with Warranty ({inventoryWarrantyItems.length})
                    </h3>
                    {inventoryWarrantyItems.map((item) => {
                      const status = getWarrantyStatus(item);
                      const daysUntilExpiry = item.warrantyEndDate
                        ? differenceInDays(parseISO(item.warrantyEndDate), new Date())
                        : null;

                      return (
                        <div key={item.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs py-0 h-5">
                                  <Package className="h-3 w-3 mr-0.5" />
                                  Inventory
                                </Badge>
                                {status === "active" && (
                                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs py-0 h-5">
                                    <ShieldCheck className="h-3 w-3 mr-0.5" />
                                    Active
                                  </Badge>
                                )}
                                {status === "expiring_soon" && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs py-0 h-5">
                                    <ShieldAlert className="h-3 w-3 mr-0.5" />
                                    Expiring Soon
                                  </Badge>
                                )}
                                {status === "expired" && (
                                  <Badge variant="destructive" className="text-xs py-0 h-5">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    Expired
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs mb-2">
                                <span className="text-muted-foreground">
                                  Part #: <span className="font-medium text-foreground font-mono">{item.partNumber}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Provider: <span className="font-medium text-foreground">{item.warrantyProvider || "Not specified"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Period: <span className="font-medium text-foreground">{item.warrantyPeriodMonths ? `${item.warrantyPeriodMonths} mo` : "N/A"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  Expires: <span className={`font-medium ${status === "expired" ? "text-red-600" : status === "expiring_soon" ? "text-orange-600" : "text-foreground"}`}>
                                    {item.warrantyEndDate || "N/A"}
                                    {daysUntilExpiry !== null && daysUntilExpiry >= 0 && (
                                      <span className="text-muted-foreground ml-1">({daysUntilExpiry}d)</span>
                                    )}
                                  </span>
                                </span>
                              </div>
                              
                              <Button size="sm" variant="ghost" onClick={() => handleManageWarranty(item)} className="h-7 text-xs px-2">
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit Warranty
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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